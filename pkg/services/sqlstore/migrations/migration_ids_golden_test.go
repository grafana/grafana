package migrations

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// Run with -update-golden to regenerate the golden file after deliberately
// adding a database migration:
//
//	go test ./pkg/services/sqlstore/migrations/ -run TestOSSMigrationIDsGolden -update-golden
//
// A human has to run that command. Coding agents must not regenerate the golden
// file on their own; they should stop and ask instead. The file exists so that a
// person consciously decided the migration is warranted, which an agent quietly
// regenerating it defeats.
var updateGolden = flag.Bool("update-golden", false, "rewrite the migration ID golden file")

var migrationIDsGoldenFile = filepath.Join("testdata", "migration_ids.txt")

const updateGoldenCommand = "go test ./pkg/services/sqlstore/migrations/ -run TestOSSMigrationIDsGolden -update-golden"

const migrationIDsGoldenHeader = `# Ordered list of OSS database migration IDs registered by
# OSSMigrations.AddMigration. Generated -- do not edit by hand.
#
# Adding a line here means adding a database migration. Read the notes in
# migration_ids_golden_test.go before you do.
#
# IDs are Go-quoted because some of them, having already shipped, carry
# significant leading or trailing whitespace.
#
# Regenerate:
#   ` + updateGoldenCommand + `
#
# A human has to run that command. Coding agents must stop and ask instead of
# regenerating this file themselves.
`

const migrationAddedNotice = `Adding a database migration is a big deal:

  * Resources are moving to the app platform, so schema added to the legacy SQL
    store is a dead end that has to be migrated again later.
  * It runs once on every Grafana instance that upgrades, against databases we
    do not control -- SQLite, MySQL and Postgres, of every size.
  * There is no rollback. A migration that turns out to be wrong can only be
    superseded by another migration.
  * It is frozen once it ships. Neither the ID nor the SQL can be changed again.

Prefer a change that does not touch the schema. If the migration really is
needed, regenerate the golden file in the same commit so the new IDs show up in
the diff and get reviewed:`

const migrationRemovedNotice = `Registered migration IDs were removed, renamed or reordered.

A migration that has shipped must never be renamed, reordered or deleted.
Instances that already ran it will not run it again, while instances that have
not upgraded yet will run a different sequence -- the two end up with different
schemas. To undo or change a previous migration, add a new one after it.

If you are removing a migration that has never been in a release, regenerate the
golden file:`

const humanOnlyNotice = `A human has to run that command. If you are a coding agent, stop here and ask
instead of regenerating the file yourself -- the golden file exists so that a
person consciously decided this migration is warranted.`

// TestOSSMigrationIDsGolden pins the ordered list of OSS database migration IDs
// to testdata/migration_ids.txt. New migrations are undesirable, so this test
// forces an author who adds one to also update a checked-in file, which makes
// the addition visible in review instead of hiding in one of ~90 migration
// files. It also catches the outright bugs: a shipped migration being renamed,
// reordered or deleted.
//
// The list is captured without a database. The dialect affects the SQL a
// migration emits but not the set of registered IDs, so one golden file covers
// SQLite, MySQL and Postgres.
//
// Obsolete migrations (mg.AddObsoleteMigration) are not covered: they are only
// folded into the migration list at run time, after a table-existence check
// against a live database.
func TestOSSMigrationIDsGolden(t *testing.T) {
	got := ossMigrationIDs(t)
	require.NotEmpty(t, got, "no migrations were registered")

	for _, id := range got {
		require.NotEmpty(t, id, "migration ID must not be empty")
	}

	body := renderMigrationIDsGolden(got)

	// The format has to survive a write/read round trip, otherwise a golden file
	// that differs from the registry would still compare equal.
	roundTripped, err := parseMigrationIDsGolden(body)
	require.NoError(t, err)
	require.Equal(t, got, roundTripped, "golden file format does not round trip")

	if *updateGolden {
		require.NoError(t, os.MkdirAll(filepath.Dir(migrationIDsGoldenFile), 0o750))
		require.NoError(t, os.WriteFile(migrationIDsGoldenFile, []byte(body), 0o600))
		return
	}

	golden, err := os.ReadFile(migrationIDsGoldenFile) //nolint:gosec // fixed path
	require.NoErrorf(t, err, "missing golden file %s; regenerate with:\n\n\t%s", migrationIDsGoldenFile, updateGoldenCommand)

	want, err := parseMigrationIDsGolden(string(golden))
	require.NoErrorf(t, err, "malformed golden file %s; regenerate with:\n\n\t%s", migrationIDsGoldenFile, updateGoldenCommand)

	if slices.Equal(want, got) {
		return
	}

	t.Fatal(migrationIDsDriftMessage(want, got))
}

// ossMigrationIDs returns every migration ID registered by OSSMigrations, in
// registration order.
func ossMigrationIDs(t *testing.T) []string {
	t.Helper()

	var ids []string
	// CheckExpectedMigrations builds a Migrator with no database attached, which
	// is all that is needed to enumerate IDs. Passing no expectations makes this
	// a plain "register, then inspect" call.
	err := CheckExpectedMigrations(SQLite, nil, func(mg *Migrator) {
		(&OSSMigrations{}).AddMigration(mg)
		// false: include migrations that skip the migration log, so a future one
		// still shows up here.
		ids = mg.GetMigrationIDs(false)
	})
	require.NoError(t, err)

	return ids
}

func renderMigrationIDsGolden(ids []string) string {
	var b strings.Builder
	b.WriteString(migrationIDsGoldenHeader)
	b.WriteString("\n")
	for _, id := range ids {
		fmt.Fprintf(&b, "%q\n", id)
	}
	return b.String()
}

func parseMigrationIDsGolden(body string) ([]string, error) {
	lines := strings.Split(body, "\n")
	ids := make([]string, 0, len(lines))
	for i, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		id, err := strconv.Unquote(line)
		if err != nil {
			return nil, fmt.Errorf("line %d is not a quoted migration ID: %s", i+1, line)
		}
		ids = append(ids, id)
	}
	return ids, nil
}

func migrationIDsDriftMessage(want, got []string) string {
	added := missingFrom(got, want)
	removed := missingFrom(want, got)

	var b strings.Builder
	fmt.Fprintf(&b, "The registered OSS database migrations no longer match %s.\n\n", migrationIDsGoldenFile)

	if len(added) > 0 {
		fmt.Fprintf(&b, "Added (%d):\n", len(added))
		for _, id := range added {
			fmt.Fprintf(&b, "  + %q\n", id)
		}
		b.WriteString("\n")
	}
	if len(removed) > 0 {
		fmt.Fprintf(&b, "Removed (%d):\n", len(removed))
		for _, id := range removed {
			fmt.Fprintf(&b, "  - %q\n", id)
		}
		b.WriteString("\n")
	}
	if len(added) == 0 && len(removed) == 0 {
		b.WriteString("The set of IDs is unchanged, but the registration order is different.\n\n")
	}

	if len(removed) > 0 || len(added) == 0 {
		b.WriteString(migrationRemovedNotice)
	} else {
		b.WriteString(migrationAddedNotice)
	}
	fmt.Fprintf(&b, "\n\n\t%s\n\n%s\n", updateGoldenCommand, humanOnlyNotice)

	return b.String()
}

// missingFrom returns the entries of a that do not appear anywhere in b,
// preserving the order of a.
func missingFrom(a, b []string) []string {
	inB := make(map[string]struct{}, len(b))
	for _, id := range b {
		inB[id] = struct{}{}
	}

	missing := make([]string, 0)
	for _, id := range a {
		if _, ok := inB[id]; !ok {
			missing = append(missing, id)
		}
	}
	return missing
}

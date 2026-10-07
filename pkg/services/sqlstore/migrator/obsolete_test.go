package migrator

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	_ "github.com/grafana/grafana/pkg/util/sqlite"
	"github.com/grafana/grafana/pkg/util/xorm"
)

func newTestEngine(t *testing.T) *xorm.Engine {
	t.Helper()
	// An on-disk database in the test's temp dir keeps each test fully isolated
	// (shared-cache in-memory DBs otherwise leak state across tests in the suite).
	engine, err := xorm.NewEngine("sqlite3", filepath.Join(t.TempDir(), "test.db"))
	require.NoError(t, err)
	t.Cleanup(func() { _ = engine.Close() })
	return engine
}

func obsoleteFor(t *testing.T, table, id string, m Migration) *ObsoleteMigrations {
	t.Helper()
	o := &ObsoleteMigrations{Table: table, Migrations: make([]Migration, 0)}
	o.AddMigration(id, m)
	return o
}

func TestObsoleteMigrations_SkippedWhenTableAbsent(t *testing.T) {
	engine := newTestEngine(t)

	mg := NewMigrator(engine, nil)
	mg.AddCreateMigration()
	// The obsolete migration would create a marker table; it must not run
	// because its owning table "ghost" does not exist.
	mg.AddObsoleteMigration(obsoleteFor(t, "ghost", "create marker for ghost",
		NewRawSQLMigration("CREATE TABLE ghost_marker (id INTEGER)")))

	require.NoError(t, mg.RunMigrations(context.Background(), false, 0))

	exists, err := engine.IsTableExist("ghost_marker")
	require.NoError(t, err)
	require.False(t, exists, "obsolete migration must not run when its table is absent")

	_, registered := mg.migrationIds["create marker for ghost"]
	require.False(t, registered, "obsolete migration must not be registered when its table is absent")
}

func TestObsoleteMigrations_RunWhenTableExists(t *testing.T) {
	engine := newTestEngine(t)
	_, err := engine.Exec("CREATE TABLE widget (id INTEGER)")
	require.NoError(t, err)

	mg := NewMigrator(engine, nil)
	mg.AddCreateMigration()
	mg.AddObsoleteMigration(obsoleteFor(t, "widget", "drop old widget table",
		NewDropTableMigration("widget")))

	require.NoError(t, mg.RunMigrations(context.Background(), false, 0))

	exists, err := engine.IsTableExist("widget")
	require.NoError(t, err)
	require.False(t, exists, "obsolete migration should run when its table exists")

	_, registered := mg.migrationIds["drop old widget table"]
	require.True(t, registered)
}

func TestObsoleteMigrations_RegistrationIsIdempotent(t *testing.T) {
	engine := newTestEngine(t)
	_, err := engine.Exec("CREATE TABLE keep (id INTEGER)")
	require.NoError(t, err)

	mg := NewMigrator(engine, nil)
	mg.AddObsoleteMigration(obsoleteFor(t, "keep", "noop keep", NewRawSQLMigration("")))

	// A retried run re-invokes addObsoleteMigrations; it must not panic on a
	// duplicate id nor append the migration twice.
	require.NoError(t, mg.addObsoleteMigrations())
	require.NotPanics(t, func() { require.NoError(t, mg.addObsoleteMigrations()) })

	count := 0
	for _, m := range mg.migrations {
		if m.Id() == "noop keep" {
			count++
		}
	}
	require.Equal(t, 1, count, "obsolete migration must be registered exactly once")
}

func TestObsoleteMigrations_PreservesRegistrationOrder(t *testing.T) {
	engine := newTestEngine(t)
	for _, table := range []string{"ta", "tb"} {
		_, err := engine.Exec("CREATE TABLE " + table + " (id INTEGER)")
		require.NoError(t, err)
	}

	mg := NewMigrator(engine, nil)
	// The run list follows the order the obsolete sets were registered in.
	mg.AddObsoleteMigration(obsoleteFor(t, "tb", "mig tb", NewRawSQLMigration("")))
	mg.AddObsoleteMigration(obsoleteFor(t, "ta", "mig ta", NewRawSQLMigration("")))

	require.NoError(t, mg.addObsoleteMigrations())
	require.Len(t, mg.migrations, 2)
	require.Equal(t, "mig tb", mg.migrations[0].Id())
	require.Equal(t, "mig ta", mg.migrations[1].Id())
}

func TestObsoleteMigrations_DedupesAcrossSets(t *testing.T) {
	engine := newTestEngine(t)
	_, err := engine.Exec("CREATE TABLE keep (id INTEGER)")
	require.NoError(t, err)

	mg := NewMigrator(engine, nil)
	// Two obsolete sets for the same table sharing a migration id: the id must
	// only be registered once.
	mg.AddObsoleteMigration(obsoleteFor(t, "keep", "shared id", NewRawSQLMigration("")))
	mg.AddObsoleteMigration(obsoleteFor(t, "keep", "shared id", NewRawSQLMigration("")))

	require.NoError(t, mg.addObsoleteMigrations())

	count := 0
	for _, m := range mg.migrations {
		if m.Id() == "shared id" {
			count++
		}
	}
	require.Equal(t, 1, count)
}

package migrator

import (
	"fmt"
	"strings"
)

type ExpectedMigration struct {
	Id  string
	SQL string
}

// CheckExpectedMigrations verifies that given migrations exist in migrator after running addMigrations function,
// that they are in the same order and have expected SQL.
func CheckExpectedMigrations(dialectName string, expected []ExpectedMigration, addMigrations func(migrator *Migrator)) error {
	d := NewDialect(dialectName)
	mg := newMigrator(nil, nil, "", d)
	addMigrations(mg)

	migrations := mg.migrations
	migrationNames := make([]string, 0, len(migrations))
	for _, m := range expected {
		for ; len(migrations) > 0 && migrations[0].Id() != m.Id; migrations = migrations[1:] {
			migrationNames = append(migrationNames, migrations[0].Id())
		}

		if len(migrations) == 0 {
			return fmt.Errorf("migration `%s` not found, existing migrations:\n%s", m.Id, strings.Join(migrationNames, "\n"))
		}

		sql := migrations[0].SQL(d)
		if normalizeLines(m.SQL) != normalizeLines(sql) {
			return fmt.Errorf("migration `%s` has wrong SQL:\nexpected:\n%s\nactual:\n%s", m.Id, m.SQL, sql)
		}
	}
	return nil
}

func normalizeLines(sql string) string {
	lines := strings.Split(sql, "\n")
	result := strings.Builder{}
	for _, l := range lines {
		l := strings.TrimSpace(l)
		if l == "" {
			continue
		}
		result.WriteString(l)
		result.WriteString("\n")
	}
	return result.String()
}

package migration

import (
	"embed"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

func Run(cfg *setting.Cfg, typ, connStr string, fs embed.FS, path string) error {
	engine, err := xorm.NewEngine(typ, connStr)
	if err != nil {
		return fmt.Errorf("failed to create db engine: %w", err)
	}

	m := migrator.NewMigrator(engine, cfg)
	m.AddCreateMigration()

	if err := RunWithMigrator(m, cfg, fs, path); err != nil {
		return err
	}

	return engine.Close()
}

func RunWithMigrator(m *migrator.Migrator, cfg *setting.Cfg, fs embed.FS, path string) error {
	migrations, err := getMigrations(fs, path)
	if err != nil {
		return err
	}

	for _, mig := range migrations {
		m.AddMigration(mig.name, mig.migration)
	}

	sec := cfg.Raw.Section("database")
	return m.Start(
		sec.Key("migration_locking").MustBool(true),
		sec.Key("locking_attempt_timeout_sec").MustInt(),
	)
}

type migration struct {
	name      string
	migration migrator.Migration
}

func getMigrations(fs embed.FS, path string) ([]migration, error) {
	entries, err := fs.ReadDir(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read migration dir: %w", err)
	}

	// parseStatements extracts statements from a sql file so we can execute
	// them as separate migrations. OpenFGA uses Goose as their migration egine
	// and Goose uses a single sql file for both up and down migrations.
	// Grafana only supports up migration so we strip out the down migration
	// and parse each individual statement
	parseStatements := func(data []byte) ([]string, error) {
		scripts := strings.Split(strings.TrimPrefix(string(data), "-- +goose Up"), "-- +goose Down")
		if len(scripts) != 2 {
			return nil, errors.New("malformed migration file")
		}

		// We assume that up migrations are always before down migrations
		parts := strings.SplitAfter(scripts[0], ";")
		stmts := make([]string, 0, len(parts))
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" {
				stmts = append(stmts, p)
			}
		}

		return stmts, nil
	}

	formatName := func(name string) string {
		// Each migration file start with XXX where X is a number.
		// We remove that part and prefix each migration with "zanzana".
		return strings.TrimSuffix("zanzana"+name[3:], ".sql")
	}

	migrations := make([]migration, 0, len(entries))
	for _, e := range entries {
		data, err := fs.ReadFile(path + "/" + e.Name())
		if err != nil {
			return nil, fmt.Errorf("failed to read migration file: %w", err)
		}

		stmts, err := parseStatements(data)
		if err != nil {
			return nil, fmt.Errorf("failed to parse migration: %w", err)
		}

		migrations = append(migrations, migration{
			name:      formatName(e.Name()),
			migration: &rawMigration{stmts: stmts},
		})
	}

	return migrations, nil
}

var _ migrator.CodeMigration = (*rawMigration)(nil)

type rawMigration struct {
	stmts []string
	migrator.MigrationBase
}

func (m *rawMigration) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	for _, stmt := range m.stmts {
		if _, err := sess.Exec(stmt); err != nil {
			return fmt.Errorf("failed to run migration: %w", err)
		}
	}
	return nil
}

func (m *rawMigration) SQL(dialect migrator.Dialect) string {
	return strings.Join(m.stmts, "\n")
}

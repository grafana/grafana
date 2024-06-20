package zanzana

import (
	"embed"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/openfga/openfga/assets"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/mysql"
	"github.com/openfga/openfga/pkg/storage/postgres"
	"github.com/openfga/openfga/pkg/storage/sqlcommon"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/sqlite"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

// FIXME(kalleep): Add sqlite data store.
// There is no support for sqlite atm but we are working on adding it: https://github.com/openfga/openfga/pull/1615
func NewStore(cfg *setting.Cfg, logger log.Logger) (storage.OpenFGADatastore, error) {
	grafanaDBCfg, zanzanaDBCfg, err := parseConfig(cfg, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database config: %w", err)
	}

	switch grafanaDBCfg.Type {
	case migrator.SQLite:
		connStr := grafanaDBCfg.ConnectionString
		// Initilize connection using xorm engine so we can reuse it for both migrations and data store
		engine, err := xorm.NewEngine(grafanaDBCfg.Type, connStr)
		if err != nil {
			return nil, fmt.Errorf("failed to connect to database: %w", err)
		}

		m := migrator.NewMigrator(engine, cfg)
		if err := runMigrationsWithMigrator(m, cfg, sqlite.EmbedMigrations, sqlite.SQLiteMigrationDir); err != nil {
			return nil, fmt.Errorf("failed to run migrations: %w", err)
		}

		return sqlite.NewWithDB(engine.DB().DB, zanzanaDBCfg)
	case migrator.MySQL:
		// For mysql we need to pass parseTime parameter in connection string
		connStr := grafanaDBCfg.ConnectionString + "&parseTime=true"
		if err := runMigrations(cfg, migrator.MySQL, connStr, assets.EmbedMigrations, assets.MySQLMigrationDir); err != nil {
			return nil, fmt.Errorf("failed to run migrations: %w", err)
		}

		return mysql.New(connStr, zanzanaDBCfg)
	case migrator.Postgres:
		connStr := grafanaDBCfg.ConnectionString
		if err := runMigrations(cfg, migrator.Postgres, connStr, assets.EmbedMigrations, assets.PostgresMigrationDir); err != nil {
			return nil, fmt.Errorf("failed to run migrations: %w", err)
		}

		return postgres.New(connStr, zanzanaDBCfg)
	}

	// Should never happen
	return nil, fmt.Errorf("unsupported database engine: %s", grafanaDBCfg.Type)
}

func NewEmbeddedStore(cfg *setting.Cfg, db db.DB, logger log.Logger) (storage.OpenFGADatastore, error) {
	grafanaDBCfg, zanzanaDBCfg, err := parseConfig(cfg, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database config: %w", err)
	}

	m := migrator.NewMigrator(db.GetEngine(), cfg)

	switch grafanaDBCfg.Type {
	case migrator.SQLite:
		if err := runMigrationsWithMigrator(m, cfg, sqlite.EmbedMigrations, sqlite.SQLiteMigrationDir); err != nil {
			return nil, fmt.Errorf("failed to run migrations: %w", err)
		}

		// FIXME(kalleep): We should work on getting sqlite implemtation merged upstream and replace this one
		return sqlite.NewWithDB(db.GetEngine().DB().DB, zanzanaDBCfg)
	case migrator.MySQL:
		if err := runMigrationsWithMigrator(m, cfg, assets.EmbedMigrations, assets.MySQLMigrationDir); err != nil {
			return nil, fmt.Errorf("failed to run migrations: %w", err)
		}

		// For mysql we need to pass parseTime parameter in connection string
		return mysql.New(grafanaDBCfg.ConnectionString+"&parseTime=true", zanzanaDBCfg)
	case migrator.Postgres:
		if err := runMigrationsWithMigrator(m, cfg, assets.EmbedMigrations, assets.PostgresMigrationDir); err != nil {
			return nil, fmt.Errorf("failed to run migrations: %w", err)
		}

		return postgres.New(grafanaDBCfg.ConnectionString, zanzanaDBCfg)
	}

	// Should never happen
	return nil, fmt.Errorf("unsupported database engine: %s", db.GetDialect().DriverName())
}

func parseConfig(cfg *setting.Cfg, logger log.Logger) (*sqlstore.DatabaseConfig, *sqlcommon.Config, error) {
	sec := cfg.Raw.Section("database")
	grafanaDBCfg, err := sqlstore.NewDatabaseConfig(cfg, nil)
	if err != nil {
		return nil, nil, nil
	}

	zanzanaDBCfg := &sqlcommon.Config{
		Logger: newZanzanaLogger(logger),
		// MaxTuplesPerWriteField: 0,
		// MaxTypesPerModelField:  0,
		MaxOpenConns:    grafanaDBCfg.MaxOpenConn,
		MaxIdleConns:    grafanaDBCfg.MaxIdleConn,
		ConnMaxLifetime: time.Duration(grafanaDBCfg.ConnMaxLifetime) * time.Second,
		ExportMetrics:   sec.Key("instrument_queries").MustBool(false),
	}

	return grafanaDBCfg, zanzanaDBCfg, nil
}

func runMigrations(cfg *setting.Cfg, typ, connStr string, fs embed.FS, path string) error {
	engine, err := xorm.NewEngine(typ, connStr)
	if err != nil {
		return fmt.Errorf("failed to parse database config: %w", err)
	}

	m := migrator.NewMigrator(engine, cfg)
	m.AddCreateMigration()

	return runMigrationsWithMigrator(m, cfg, fs, path)
}

func runMigrationsWithMigrator(m *migrator.Migrator, cfg *setting.Cfg, fs embed.FS, path string) error {
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

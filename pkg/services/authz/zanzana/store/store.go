package store

import (
	"fmt"
	"strings"
	"time"

	"github.com/openfga/openfga/assets"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/mysql"
	"github.com/openfga/openfga/pkg/storage/postgres"
	"github.com/openfga/openfga/pkg/storage/sqlcommon"
	"github.com/openfga/openfga/pkg/storage/sqlite"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"

	zlogger "github.com/grafana/grafana/pkg/services/authz/zanzana/logger"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/store/migration"
)

func NewStore(cfg *setting.Cfg, logger log.Logger) (storage.OpenFGADatastore, error) {
	grafanaDBCfg, zanzanaDBCfg, err := parseConfig(cfg, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database config: %w", err)
	}

	switch grafanaDBCfg.Type {
	case migrator.SQLite:
		connStr := sqliteConnectionString(grafanaDBCfg.ConnectionString)
		if err := migration.Run(cfg, migrator.SQLite, connStr, assets.EmbedMigrations, assets.SqliteMigrationDir); err != nil {
			return nil, fmt.Errorf("failed to run migrations: %w", err)
		}

		return sqlite.New(connStr, zanzanaDBCfg)
	case migrator.MySQL:
		// For mysql we need to pass parseTime parameter in connection string
		connStr := grafanaDBCfg.ConnectionString + "&parseTime=true"
		if err := migration.Run(cfg, migrator.MySQL, connStr, assets.EmbedMigrations, assets.MySQLMigrationDir); err != nil {
			return nil, fmt.Errorf("failed to run migrations: %w", err)
		}

		return mysql.New(connStr, zanzanaDBCfg)
	case migrator.Postgres:
		connStr := grafanaDBCfg.ConnectionString
		if err := migration.Run(cfg, migrator.Postgres, connStr, assets.EmbedMigrations, assets.PostgresMigrationDir); err != nil {
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

	switch grafanaDBCfg.Type {
	case migrator.SQLite:
		grafanaDBCfg.ConnectionString = sqliteConnectionString(grafanaDBCfg.ConnectionString)
		if err := migration.Run(cfg, migrator.SQLite, grafanaDBCfg.ConnectionString, assets.EmbedMigrations, assets.SqliteMigrationDir); err != nil {
			return nil, fmt.Errorf("failed to run migrations: %w", err)
		}

		return sqlite.New(grafanaDBCfg.ConnectionString, zanzanaDBCfg)
	case migrator.MySQL:
		m := migrator.NewMigrator(db.GetEngine(), cfg)
		if err := migration.RunWithMigrator(m, cfg, assets.EmbedMigrations, assets.MySQLMigrationDir); err != nil {
			return nil, fmt.Errorf("failed to run migrations: %w", err)
		}

		// For mysql we need to pass parseTime parameter in connection string
		return mysql.New(grafanaDBCfg.ConnectionString+"&parseTime=true", zanzanaDBCfg)
	case migrator.Postgres:
		m := migrator.NewMigrator(db.GetEngine(), cfg)
		if err := migration.RunWithMigrator(m, cfg, assets.EmbedMigrations, assets.PostgresMigrationDir); err != nil {
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
		Logger:                 zlogger.New(logger),
		MaxTuplesPerWriteField: 100,
		MaxTypesPerModelField:  100,
		MaxOpenConns:           grafanaDBCfg.MaxOpenConn,
		MaxIdleConns:           grafanaDBCfg.MaxIdleConn,
		ConnMaxLifetime:        time.Duration(grafanaDBCfg.ConnMaxLifetime) * time.Second,
		ExportMetrics:          sec.Key("instrument_queries").MustBool(false),
	}

	return grafanaDBCfg, zanzanaDBCfg, nil
}

func sqliteConnectionString(v string) string {
	// hardcode zanzana.db for now
	return v[0:strings.LastIndex(v, "/")+1] + "zanzana.db"
}

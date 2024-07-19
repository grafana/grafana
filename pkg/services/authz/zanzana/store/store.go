package store

import (
	"fmt"
	"time"

	"xorm.io/xorm"

	"github.com/openfga/openfga/assets"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/mysql"
	"github.com/openfga/openfga/pkg/storage/postgres"
	"github.com/openfga/openfga/pkg/storage/sqlcommon"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"

	zlogger "github.com/grafana/grafana/pkg/services/authz/zanzana/logger"
	zassets "github.com/grafana/grafana/pkg/services/authz/zanzana/store/assets"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/store/migration"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/store/sqlite"
)

func NewStore(cfg *setting.Cfg, logger log.Logger) (storage.OpenFGADatastore, error) {
	grafanaDBCfg, zanzanaDBCfg, err := parseConfig(cfg, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database config: %w", err)
	}

	switch grafanaDBCfg.Type {
	case migrator.SQLite:
		connStr := grafanaDBCfg.ConnectionString
		// Initilize connection using xorm engine so we can reuse it for both migrations and data store
		engine, err := xorm.NewEngine(grafanaDBCfg.Type, connStr, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to connect to database: %w", err)
		}

		m := migrator.NewMigrator(engine, cfg)
		if err := migration.RunWithMigrator(m, cfg, zassets.EmbedMigrations, zassets.SQLiteMigrationDir); err != nil {
			return nil, fmt.Errorf("failed to run migrations: %w", err)
		}

		return sqlite.NewWithDB(engine.DB().DB, &sqlite.Config{
			Config:       zanzanaDBCfg,
			QueryRetries: grafanaDBCfg.QueryRetries,
		})
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

	m := migrator.NewMigrator(db.GetEngine(), cfg)

	switch grafanaDBCfg.Type {
	case migrator.SQLite:
		if err := migration.RunWithMigrator(m, cfg, zassets.EmbedMigrations, zassets.SQLiteMigrationDir); err != nil {
			return nil, fmt.Errorf("failed to run migrations: %w", err)
		}

		// FIXME(kalleep): We should work on getting sqlite implemtation merged upstream and replace this one
		return sqlite.NewWithDB(db.GetEngine().DB().DB, &sqlite.Config{
			Config:       zanzanaDBCfg,
			QueryRetries: grafanaDBCfg.QueryRetries,
		})
	case migrator.MySQL:
		if err := migration.RunWithMigrator(m, cfg, assets.EmbedMigrations, assets.MySQLMigrationDir); err != nil {
			return nil, fmt.Errorf("failed to run migrations: %w", err)
		}

		// For mysql we need to pass parseTime parameter in connection string
		return mysql.New(grafanaDBCfg.ConnectionString+"&parseTime=true", zanzanaDBCfg)
	case migrator.Postgres:
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

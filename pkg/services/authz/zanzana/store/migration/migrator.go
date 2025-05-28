package migration

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/openfga/openfga/pkg/storage/migrate"
)

func Run(cfg *setting.Cfg, dbType string, grafanaDBConfg *sqlstore.DatabaseConfig, logger log.Logger) error {
	connStr := grafanaDBConfg.ConnectionString
	// running grafana migrations
	engine, err := xorm.NewEngine(dbType, connStr)
	if err != nil {
		return fmt.Errorf("failed to create db engine: %w", err)
	}

	m := migrator.NewMigrator(engine, cfg)
	m.AddCreateMigration()

	if err := RunWithMigrator(m, cfg); err != nil {
		return err
	}

	// running openfga migrations
	switch dbType {
	case migrator.SQLite:
		// openfga expects sqlite but grafana uses sqlite3
		dbType = "sqlite"
	case migrator.Postgres:
		// Parse and transform the connection string to the format OpenFGA expects
		connStr = constructPostgresConnStrForOpenFGA(grafanaDBConfg)
	}

	migrationConfig := migrate.MigrationConfig{
		URI:    connStr,
		Engine: dbType,
	}

	if err := migrate.RunMigrations(migrationConfig); err != nil {
		return fmt.Errorf("failed to run openfga migrations: %w", err)
	}

	if err := engine.Close(); err != nil {
		logger.Warn("failed to close db engine", "error", err)
	}

	return nil
}

func RunWithMigrator(m *migrator.Migrator, cfg *setting.Cfg) error {
	openfgaTables := []string{"tuple", "authorization_model", "store", "assertion", "changelog"}
	for _, table := range openfgaTables {
		m.AddMigration(fmt.Sprintf("Drop existing openfga table %s", table), migrator.NewDropTableMigration(table))
	}

	sec := cfg.Raw.Section("database")
	lockingEnabled := sec.Key("migration_locking").MustBool(false)
	lockTimeout := sec.Key("locking_attempt_timeout_sec").MustInt(30)

	return m.Start(lockingEnabled, lockTimeout)
}

// constructPostgresConnStrForOpenFGA parses a PostgreSQL connection string into a map of key-value pairs
// parses into a format like
// postgresql://grafana:password@127.0.0.1:5432/grafana?sslmode=disable&sslcert=&sslkey=&sslrootcert=
func constructPostgresConnStrForOpenFGA(grafanaDBCfg *sqlstore.DatabaseConfig) string {
	connectionStr := fmt.Sprintf("postgresql://%s:%s@%s/%s", grafanaDBCfg.User, grafanaDBCfg.Pwd, grafanaDBCfg.Host, grafanaDBCfg.Name)

	sslParams := fmt.Sprintf("?sslmode=%s&sslcert=%s&sslkey=%s&sslrootcert=%s", grafanaDBCfg.SslMode, grafanaDBCfg.ClientCertPath, grafanaDBCfg.ClientKeyPath, grafanaDBCfg.CaCertPath)

	return connectionStr + sslParams
}

package migration

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/openfga/openfga/pkg/storage/migrate"
)

func Run(cfg *setting.Cfg, dbType string, grafanaDBConfig *sqlstore.DatabaseConfig, logger log.Logger) error {
	connStr := grafanaDBConfig.ConnectionString
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
		connStr = constructPostgresConnStrForOpenFGA(grafanaDBConfig)
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

	return m.Start(
		sec.Key("migration_locking").MustBool(true),
		sec.Key("locking_attempt_timeout_sec").MustInt(30),
	)
}

// constructPostgresConnStrForOpenFGA parses a PostgreSQL connection string into a map of key-value pairs
// parses into a format like
// postgresql://grafana:password@127.0.0.1:5432/grafana?sslmode=disable&lock_timeout=2s&statement_timeout=10s
func constructPostgresConnStrForOpenFGA(grafanaDBCfg *sqlstore.DatabaseConfig) string {
	// Parse host and port from the Host field (which might contain both)
	addr, err := util.SplitHostPortDefault(grafanaDBCfg.Host, "127.0.0.1", "5432")
	if err != nil {
		// If parsing fails, use the host as-is and assume default port
		addr = util.NetworkAddress{Host: grafanaDBCfg.Host, Port: "5432"}
	}

	// Construct the connection string with proper host:port format
	connectionStr := fmt.Sprintf("postgresql://%s:%s@%s:%s/%s",
		grafanaDBCfg.User, grafanaDBCfg.Pwd, addr.Host, addr.Port, grafanaDBCfg.Name)

	// Build query parameters - always include sslmode and timeouts
	queryParams := fmt.Sprintf("sslmode=%s&lock_timeout=2s&statement_timeout=10s", grafanaDBCfg.SslMode)

	// Only add SSL certificate parameters if they are not empty
	if grafanaDBCfg.ClientCertPath != "" {
		queryParams += fmt.Sprintf("&sslcert=%s", grafanaDBCfg.ClientCertPath)
	}
	if grafanaDBCfg.ClientKeyPath != "" {
		queryParams += fmt.Sprintf("&sslkey=%s", grafanaDBCfg.ClientKeyPath)
	}
	if grafanaDBCfg.CaCertPath != "" {
		queryParams += fmt.Sprintf("&sslrootcert=%s", grafanaDBCfg.CaCertPath)
	}

	return connectionStr + "?" + queryParams
}

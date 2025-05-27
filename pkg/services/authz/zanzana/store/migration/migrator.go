package migration

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/openfga/openfga/pkg/storage/migrate"
)

func Run(cfg *setting.Cfg, dbType string, grafanaDBConfg *sqlstore.DatabaseConfig, logger log.Logger) error {
	connStr := grafanaDBConfg.ConnectionString
	// running grafana migrations
	engine, err := xorm.NewEngine(dbType, connStr)
	if err != nil {
		return fmt.Errorf("failed to create db engine: %w", err)
	}
	err = engine.Close()
	if err != nil {
		return fmt.Errorf("failed to close db engine: %w", err)
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

	migrationErr := migrate.RunMigrations(migrate.MigrationConfig{
		URI:    connStr,
		Engine: dbType,
	})
	if migrationErr != nil {
		logger.Error("failed to run migrations", "error", migrationErr)
		return fmt.Errorf("failed to run migrations: %w", migrationErr)
	}

	return nil
}

func RunWithMigrator(m *migrator.Migrator, cfg *setting.Cfg) error {
	migrations, err := getMigrations()
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

func getMigrations() ([]migration, error) {
	// create the drop migrations
	data := `DROP TABLE IF EXISTS tuple;
	DROP TABLE IF EXISTS authorization_model;
	DROP TABLE IF EXISTS store;
	DROP TABLE IF EXISTS assertion;
	DROP TABLE IF EXISTS changelog;`

	migrations := []migration{
		{
			name:      "zanzana_removal_grafana_migrations_to_openfga_migrations.sql",
			migration: &rawMigration{stmts: []string{data}},
		},
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

// constructPostgresConnStrForOpenFGA parses a PostgreSQL connection string into a map of key-value pairs
// parses into a format like
// postgresql://grafana:password@127.0.0.1:5432/grafana?sslmode=disable&sslcert=&sslkey=&sslrootcert=
func constructPostgresConnStrForOpenFGA(grafanaDBCfg *sqlstore.DatabaseConfig) string {
	connectionStr := fmt.Sprintf("postgresql://%s:%s@%s/%s", grafanaDBCfg.User, grafanaDBCfg.Pwd, grafanaDBCfg.Host, grafanaDBCfg.Name)

	sslParams := fmt.Sprintf("?sslmode=%s&sslcert=%s&sslkey=%s&sslrootcert=%s", grafanaDBCfg.SslMode, grafanaDBCfg.ClientCertPath, grafanaDBCfg.ClientKeyPath, grafanaDBCfg.CaCertPath)

	return connectionStr + sslParams
}

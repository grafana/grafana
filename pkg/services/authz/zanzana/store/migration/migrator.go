package migration

import (
	"embed"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/openfga/openfga/pkg/storage/migrate"
)

// parsePostgresConnStr parses a PostgreSQL connection string into a map of key-value pairs
func parsePostgresConnStr(connStr string) map[string]string {
	// Extract key parameters from the connection string, handling quoted values
	re := regexp.MustCompile(`(\w+)=(?:'([^']*)'|([^ ]*))`)
	matches := re.FindAllStringSubmatch(connStr, -1)

	// Build a map of connection parameters
	params := make(map[string]string)
	for _, match := range matches {
		if len(match) >= 3 {
			// If the value was quoted, use the quoted value (index 2), otherwise use the unquoted value (index 3)
			value := match[2]
			if value == "" && len(match) > 3 {
				value = match[3]
			}
			params[match[1]] = value
		}
	}

	// Set defaults for required parameters
	if _, ok := params["host"]; !ok {
		params["host"] = "localhost"
	}
	if _, ok := params["port"]; !ok {
		params["port"] = "5432"
	}

	return params
}

func Run(cfg *setting.Cfg, dbType, connStr string, fs embed.FS, path string, logger log.Logger) error {
	logger.Debug("Original connection string", "dbType", dbType, "connStr", connStr)

	// For PostgreSQL, convert to URL format expected by OpenFGA
	if dbType == migrator.Postgres {
		// Create a temporary xorm engine to extract connection details
		engine, err := xorm.NewEngine(dbType, connStr)
		if err != nil {
			return fmt.Errorf("failed to initialize xorm engine: %w", err)
		}
		defer engine.Close()

		// Get parsed dataSourceName to build the URL
		dialect := engine.Dialect()
		if dialect == nil {
			return fmt.Errorf("unable to get dialect from engine")
		}

		// Extract database connection info from the engine
		dbName := dialect.URI().DbName
		if dbName == "" {
			return fmt.Errorf("unable to extract database name from connection string")
		}

		// Create connection URL based on engine dialect information
		pgURL := &url.URL{
			Scheme: "postgresql",
			Path:   "/" + dbName,
		}

		// Extract all connection parameters from the connection string
		params := parsePostgresConnStr(connStr)

		// Set user and password
		userStr := params["user"]
		if userStr == "" {
			userStr = "grafana"
		}
		pgURL.User = url.UserPassword(
			url.QueryEscape(userStr),
			url.QueryEscape(params["password"]),
		)

		// Set host and port
		host := params["host"]
		if host == "" {
			host = "127.0.0.1"
		}
		port := params["port"]
		if port == "" {
			port = "5432"
		}
		pgURL.Host = fmt.Sprintf("%s:%s", host, port)

		// Add SSL mode and other SSL parameters if present
		query := url.Values{}
		for _, param := range []string{"sslmode", "sslcert", "sslkey", "sslrootcert"} {
			if value, ok := params[param]; ok && value != "" {
				query.Set(param, value)
			}
		}
		if len(query) > 0 {
			pgURL.RawQuery = query.Encode()
		}

		// Use the constructed URL
		logger.Debug("Converted postgres connection string", "original", connStr, "pgURL", pgURL.String())
		connStr = pgURL.String()
	}

	logger.Debug("Running migrations", "dbType", dbType, "connStr", connStr)
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

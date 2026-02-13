package kv

import (
	"fmt"
	"strings"
)

// Dialect handles database-specific SQL generation
type Dialect interface {
	Name() string
	QuoteIdent(name string) string
	Placeholder(n int) string
}

// DialectFromDriver returns the appropriate dialect for a driver name
func DialectFromDriver(driverName string) (Dialect, error) {
	switch strings.ToLower(driverName) {
	case "mysql":
		return mysqlDialect{}, nil
	case "postgres", "pgx":
		return postgresDialect{}, nil
	case "sqlite", "sqlite3":
		return sqliteDialect{}, nil
	default:
		return nil, fmt.Errorf("unsupported driver: %s", driverName)
	}
}

// mysqlDialect implements MySQL-specific SQL generation
type mysqlDialect struct{}

func (d mysqlDialect) Name() string { return "mysql" }

func (d mysqlDialect) QuoteIdent(name string) string {
	// Handle table.column format
	parts := strings.Split(name, ".")
	for i, part := range parts {
		parts[i] = "`" + strings.ReplaceAll(part, "`", "``") + "`"
	}
	return strings.Join(parts, ".")
}

func (d mysqlDialect) Placeholder(n int) string {
	return "?"
}

// postgresDialect implements PostgreSQL-specific SQL generation
type postgresDialect struct{}

func (d postgresDialect) Name() string { return "postgres" }

func (d postgresDialect) QuoteIdent(name string) string {
	parts := strings.Split(name, ".")
	for i, part := range parts {
		parts[i] = `"` + strings.ReplaceAll(part, `"`, `""`) + `"`
	}
	return strings.Join(parts, ".")
}

func (d postgresDialect) Placeholder(n int) string {
	return fmt.Sprintf("$%d", n)
}

// sqliteDialect implements SQLite-specific SQL generation
type sqliteDialect struct{}

func (d sqliteDialect) Name() string { return "sqlite" }

func (d sqliteDialect) QuoteIdent(name string) string {
	parts := strings.Split(name, ".")
	for i, part := range parts {
		parts[i] = `"` + strings.ReplaceAll(part, `"`, `""`) + `"`
	}
	return strings.Join(parts, ".")
}

func (d sqliteDialect) Placeholder(n int) string {
	return "?"
}

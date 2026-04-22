package database

import (
	"strings"

	sq "github.com/Masterminds/squirrel"
)

// NewBuilder returns a squirrel statement builder and placeholder format matched
// to the database driver. Postgres uses $N, MySQL/SQLite use ?. Driver name
// matching is case-insensitive and follows the aliases used by
// pkg/storage/unified/sql/sqltemplate.
func NewBuilder(driver string) (sq.StatementBuilderType, sq.PlaceholderFormat) {
	switch strings.ToLower(driver) {
	case "postgres", "pgx":
		return sq.StatementBuilder.PlaceholderFormat(sq.Dollar), sq.Dollar
	default:
		return sq.StatementBuilder.PlaceholderFormat(sq.Question), sq.Question
	}
}

// ApplyForUpdate appends FOR UPDATE to the select unless the driver is SQLite,
// which does not support row locking. Mirrors the old sqltemplate
// `.SelectFor "UPDATE"` helper.
func ApplyForUpdate(q sq.SelectBuilder, driver string) sq.SelectBuilder {
	switch strings.ToLower(driver) {
	case "sqlite", "sqlite3":
		return q
	default:
		return q.Suffix("FOR UPDATE")
	}
}

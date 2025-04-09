package database

import (
	"context"
	"database/sql"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

// Implements contracts.Database
type Database struct {
	db db.DB
}

func New(db db.DB) *Database {
	return &Database{db: db}
}

func (db *Database) Transaction(ctx context.Context, f func(context.Context) error) error {
	return db.db.InTransaction(ctx, f)
}

func (db *Database) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return db.db.GetSqlxSession().Exec(ctx, query, args...)
}

func (db *Database) QueryContext(ctx context.Context, query string, args ...any) (contracts.Rows, error) {
	return db.db.GetSqlxSession().Query(ctx, query, args...)
}

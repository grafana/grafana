package kv

import (
	"context"
	"database/sql"
)

// dbtx is a common interface satisfied by both *sql.DB and *sql.Tx.
// It is used to transparently run sqlkv operations inside an external
// transaction (e.g. a migration transaction on SQLite).
type dbtx interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

type dbtxContextKey struct{}

// ContextWithDBTX stores a *sql.Tx in the context for the bulk import path
// on SQLite. This makes conn() return the migration's transaction instead of
// the default *sql.DB, avoiding write-lock contention.
func ContextWithDBTX(ctx context.Context, tx *sql.Tx) context.Context {
	return context.WithValue(ctx, dbtxContextKey{}, tx)
}

// dbtxFromCtx retrieves the dbtx stored by ContextWithDBTX.
func dbtxFromCtx(ctx context.Context) (dbtx, bool) {
	val := ctx.Value(dbtxContextKey{})
	if val == nil {
		return nil, false
	}
	db, ok := val.(dbtx)
	return db, ok
}

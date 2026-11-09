package kv

import (
	"context"
	"database/sql"
	"time"
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
type keysStatementTimeoutContextKey struct{}

// ContextWithKeysStatementTimeout makes SqlKV run the key listings made with ctx in a transaction
// whose Postgres statement_timeout is d. A listing's query stays open while its caller works
// through the keys, as a search index build does.
func ContextWithKeysStatementTimeout(ctx context.Context, d time.Duration) context.Context {
	return context.WithValue(ctx, keysStatementTimeoutContextKey{}, d)
}

func keysStatementTimeoutFromCtx(ctx context.Context) time.Duration {
	d, _ := ctx.Value(keysStatementTimeoutContextKey{}).(time.Duration)
	return d
}

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

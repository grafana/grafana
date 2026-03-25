package kv

import (
	"context"
	"database/sql"
)

// txExecer is a minimal interface for executing SQL within a transaction.
// Both *sql.Tx and Grafana's db.Tx satisfy this interface because
// db.Result is a type alias for sql.Result.
type txExecer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

// dbtx is a common interface satisfied by both *sql.DB and *sql.Tx.
// It is used to transparently run sqlkv operations inside an external
// transaction (e.g. a migration transaction on SQLite).
type dbtx interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

type txContextKey string

const txKey txContextKey = "kv_db_tx"

type dbtxContextKey struct{}

// ContextWithTx stores a transaction executor in the context.
// The value must implement txExecer (e.g. *sql.Tx, db.Tx).
// This is used by storage_backend.go to pass a transaction to sqlkv for
// backwards-compatibility mode operations.
func ContextWithTx(ctx context.Context, tx any) context.Context {
	return context.WithValue(ctx, txKey, tx)
}

// txFromCtx retrieves a transaction executor from the context.
func txFromCtx(ctx context.Context) (txExecer, bool) {
	val := ctx.Value(txKey)
	if val == nil {
		return nil, false
	}
	tx, ok := val.(txExecer)
	return tx, ok
}

// ContextWithDBTX stores a *sql.Tx in the context so that sqlkv methods
// route all SQL through it instead of the default *sql.DB.
// This is used during bulk import on SQLite to avoid write-lock contention
// with the migration framework's session transaction.
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

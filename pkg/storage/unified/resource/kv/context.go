package kv

// This file defines two independent context-based transaction mechanisms used
// by different code paths. They use separate context keys and are never both
// set in the same context.
//
// 1. ContextWithTx / TxFromCtx (key: txKey)
//    Single-write compat path (WriteEvent → ExecWithRV → Save).
//    ExecWithRV opens its own db.Tx and stores it so the save writer can
//    insert legacy resource_history columns within that transaction.
//    Needs ExecContext only (TxExecer interface).
//
// 2. ContextWithDBTX / dbtxFromCtx (key: dbtxContextKey{})
//    Bulk import on SQLite. The migration framework holds a write
//    transaction; ContextWithDBTX routes all conn() calls through it so
//    KV operations avoid SQLITE_BUSY from separate connections.
//    Needs ExecContext, QueryContext, QueryRowContext (dbtx interface).

import (
	"context"
	"database/sql"
)

// TxExecer is a minimal interface for executing SQL within a transaction.
// Both *sql.Tx and Grafana's db.Tx satisfy this interface because
// db.Result is a type alias for sql.Result.
type TxExecer interface {
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
// This is used by storage_backend.go to pass a transaction to sqlkv for
// backwards-compatibility mode operations.
// Note: We store the tx as-is. The caller should ensure the type implements TxExecer.
func ContextWithTx(ctx context.Context, tx TxExecer) context.Context {
	return context.WithValue(ctx, txKey, tx)
}

// TxFromCtx retrieves a transaction executor from the context.
// Returns nil and false if no transaction is present.
// Note: We attempt to assert to TxExecer. If the stored value is a db.Tx,
// this will work because db.Tx.ExecContext returns sql.Result (via type alias).
func TxFromCtx(ctx context.Context) (TxExecer, bool) {
	val := ctx.Value(txKey)
	if val == nil {
		return nil, false
	}
	tx, ok := val.(TxExecer)
	if !ok {
		// The stored value doesn't implement TxExecer directly
		// This shouldn't happen if ContextWithTx was called correctly
		return nil, false
	}
	return tx, true
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

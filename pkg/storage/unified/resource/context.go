package resource

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

type txContextKey string

const txKey txContextKey = "kv_db_tx"

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

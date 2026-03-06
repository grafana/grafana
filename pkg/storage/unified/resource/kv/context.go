package kv

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

type backwardsCompatilityData struct {
	tx   TxExecer
	guid string
}

type backwardsCompatilityContextKey string

const backwardsCompatilityKey backwardsCompatilityContextKey = "kv_backwards_compatibility"

// ContextWithBackwardsCompatilityData stores the SQL compatibility data used by sqlkv when
// storage_backend.go is emulating the legacy unified/sql write path.
func ContextWithBackwardsCompatilityData(ctx context.Context, tx TxExecer, guid string) context.Context {
	return context.WithValue(ctx, backwardsCompatilityKey, backwardsCompatilityData{
		tx:   tx,
		guid: guid,
	})
}

func backwardsCompatilityDataFromCtx(ctx context.Context) (backwardsCompatilityData, bool) {
	val := ctx.Value(backwardsCompatilityKey)
	if val == nil {
		return backwardsCompatilityData{}, false
	}

	data, ok := val.(backwardsCompatilityData)
	if !ok || data.tx == nil || data.guid == "" {
		return backwardsCompatilityData{}, false
	}

	return data, true
}

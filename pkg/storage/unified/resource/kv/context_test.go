package kv

import (
	"context"
	"database/sql"
	"testing"

	"github.com/stretchr/testify/require"
)

type noopTxExecer struct{}

func (noopTxExecer) ExecContext(_ context.Context, _ string, _ ...any) (sql.Result, error) {
	return nil, nil
}

func TestContextWithBackwardsCompatilityData(t *testing.T) {
	ctx := ContextWithBackwardsCompatilityData(context.Background(), noopTxExecer{}, "test-guid")

	data, ok := backwardsCompatilityDataFromCtx(ctx)
	require.True(t, ok)
	require.Equal(t, "test-guid", data.guid)
	require.NotNil(t, data.tx)
}

func TestBackwardsCompatilityDataFromCtxRejectsIncompleteData(t *testing.T) {
	_, ok := backwardsCompatilityDataFromCtx(context.Background())
	require.False(t, ok)

	ctxWithoutGUID := ContextWithBackwardsCompatilityData(context.Background(), noopTxExecer{}, "")
	_, ok = backwardsCompatilityDataFromCtx(ctxWithoutGUID)
	require.False(t, ok)
}

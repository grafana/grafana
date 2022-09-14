package log

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestContextualArgs(t *testing.T) {
	ctx := context.Background()

	ctxArgs := contextualArgs(ctx)
	require.Nil(t, ctxArgs)

	ctx = WithContextualArgs(ctx, "k", "v")
	ctxArgs = contextualArgs(ctx)
	require.NotNil(t, ctxArgs)
	require.Equal(t, []interface{}{"k", "v"}, ctxArgs.args)

	ctx = WithContextualArgs(ctx, "k2", "v2")
	ctxArgs = contextualArgs(ctx)
	require.NotNil(t, ctxArgs)
	require.Equal(t, []interface{}{"k", "v", "k2", "v2"}, ctxArgs.args)

	ctx = WithContextualArgs(ctx, "k3", "v3", "k4", "v4")
	ctxArgs = contextualArgs(ctx)
	require.NotNil(t, ctxArgs)
	require.Equal(t, []interface{}{"k", "v", "k2", "v2", "k3", "v3", "k4", "v4"}, ctxArgs.args)
}

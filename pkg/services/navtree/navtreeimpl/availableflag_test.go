package navtreeimpl

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
)

func mustFlagExpr(t *testing.T, jsonValue string) *plugins.FlagExpr {
	t.Helper()
	var f plugins.FlagExpr
	require.NoError(t, json.Unmarshal([]byte(jsonValue), &f))
	return &f
}

func TestEvaluateAvailable(t *testing.T) {
	ctx := context.Background()

	t.Run("nil expr (field omitted) is always visible", func(t *testing.T) {
		require.True(t, evaluateAvailable(ctx, nil))
	})

	t.Run("static override", func(t *testing.T) {
		require.True(t, evaluateAvailable(ctx, mustFlagExpr(t, `true`)))
		require.False(t, evaluateAvailable(ctx, mustFlagExpr(t, `false`)))
	})

	t.Run("bare flag key resolves against a real registered flag", func(t *testing.T) {
		setupOpenFeatureFlag(t, "test.availableFlag", true)
		require.True(t, evaluateAvailable(ctx, mustFlagExpr(t, `"test.availableFlag"`)))
	})

	t.Run("bare flag key fails closed when the flag can't be resolved", func(t *testing.T) {
		setupOpenFeatureFlag(t, "test.someOtherFlag", true)
		require.False(t, evaluateAvailable(ctx, mustFlagExpr(t, `"test.unregisteredFlag"`)))
	})

	t.Run("explicit expression can choose to fail open instead", func(t *testing.T) {
		setupOpenFeatureFlag(t, "test.someOtherFlag", true)
		expr := mustFlagExpr(t, `"{{ flag `+"`"+`test.unregisteredFlag`+"`"+` true }}"`)
		require.True(t, evaluateAvailable(ctx, expr))
	})

	t.Run("compound expression combines multiple flags with or", func(t *testing.T) {
		setupOpenFeatureFlag(t, "test.availableFlag", false)
		expr := mustFlagExpr(t, `"{{ or (flag `+"`"+`test.availableFlag`+"`"+` false) (flag `+"`"+`test.unregisteredFlag`+"`"+` true) }}"`)
		require.True(t, evaluateAvailable(ctx, expr))
	})

	t.Run("fails open when the bound flag closure panics", func(t *testing.T) {
		// A nil context makes OpenFeature panic; evaluateAvailable must recover
		// because template execution doesn't recover runtime panics.
		var nilCtx context.Context
		require.NotPanics(t, func() {
			require.True(t, evaluateAvailable(nilCtx, mustFlagExpr(t, `"test.anyFlag"`)))
		})
	})
}

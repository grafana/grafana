package featuremgmt

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func Test_StaticEvaluator_TypedFlags(t *testing.T) {
	conf := []byte(`
[feature_toggles]
testflag42 = {"a":1, "b":2}
stringFlag = "hello world"
boolFlag = true
intFlag = 42
floatFlag = 3.14159
`)

	cfg, err := setting.NewCfgFromBytes(conf)
	require.NoError(t, err)

	// Initialize OpenFeature with the static provider
	err = InitOpenFeatureWithCfg(cfg)
	require.NoError(t, err)

	// Create the static evaluator
	staticEvaluator, err := CreateStaticEvaluator(cfg)
	require.NoError(t, err)

	ctx := context.Background()

	t.Run("object flag - testflag42", func(t *testing.T) {
		result, err := staticEvaluator.EvalFlag(ctx, "testflag42")
		require.NoError(t, err)
		require.Equal(t, "testflag42", result.Key)

		// JSON numbers are decoded as float64
		expected := map[string]any{"a": float64(1), "b": float64(2)}
		require.Equal(t, expected, result.Value)
		require.Equal(t, "static provider evaluation result", result.Reason)
		require.Equal(t, "default", result.Variant)
	})

	t.Run("string flag", func(t *testing.T) {
		result, err := staticEvaluator.EvalFlag(ctx, "stringFlag")
		require.NoError(t, err)
		require.Equal(t, "stringFlag", result.Key)
		require.Equal(t, "hello world", result.Value)
		require.IsType(t, "", result.Value)
	})

	t.Run("boolean flag", func(t *testing.T) {
		result, err := staticEvaluator.EvalFlag(ctx, "boolFlag")
		require.NoError(t, err)
		require.Equal(t, "boolFlag", result.Key)
		require.Equal(t, true, result.Value)
		require.IsType(t, true, result.Value)
	})

	t.Run("integer flag", func(t *testing.T) {
		result, err := staticEvaluator.EvalFlag(ctx, "intFlag")
		require.NoError(t, err)
		require.Equal(t, "intFlag", result.Key)
		require.Equal(t, int64(42), result.Value)
		require.IsType(t, int64(0), result.Value)
	})

	t.Run("float flag", func(t *testing.T) {
		result, err := staticEvaluator.EvalFlag(ctx, "floatFlag")
		require.NoError(t, err)
		require.Equal(t, "floatFlag", result.Key)
		require.Equal(t, 3.14159, result.Value)
		require.IsType(t, float64(0), result.Value)
	})

	t.Run("bulk evaluation includes all typed flags", func(t *testing.T) {
		allFlags, err := staticEvaluator.EvalAllFlags(ctx)
		require.NoError(t, err)
		require.NotEmpty(t, allFlags.Flags)

		// Build a map for easier lookup
		flagMap := make(map[string]any)
		for _, flag := range allFlags.Flags {
			flagMap[flag.Key] = flag.Value
		}

		// Verify all our test flags are present with correct types
		require.Contains(t, flagMap, "testflag42")
		require.Contains(t, flagMap, "stringFlag")
		require.Contains(t, flagMap, "boolFlag")
		require.Contains(t, flagMap, "intFlag")
		require.Contains(t, flagMap, "floatFlag")

		// Verify types
		require.IsType(t, map[string]any{}, flagMap["testflag42"])
		require.IsType(t, "", flagMap["stringFlag"])
		require.IsType(t, true, flagMap["boolFlag"])
		require.IsType(t, int64(0), flagMap["intFlag"])
		require.IsType(t, float64(0), flagMap["floatFlag"])
	})

	t.Run("non-existent flag returns error", func(t *testing.T) {
		_, err := staticEvaluator.EvalFlag(ctx, "doesNotExist")
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found")
	})
}

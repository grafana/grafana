package featuremgmt

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/setting"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_StaticProvider(t *testing.T) {
	ctx := context.Background()
	evalCtx := openfeature.NewEvaluationContext("grafana", nil)

	stFeat := standardFeatureFlags[0]
	stFeatName := stFeat.Name
	stFeatValue := stFeat.Expression == "true"

	t.Run("empty config loads standard flags", func(t *testing.T) {
		setup(t, []byte(``))
		// Check for one of the standard flags
		feat, err := openfeature.GetApiInstance().GetClient().BooleanValueDetails(ctx, stFeatName, !stFeatValue, evalCtx)
		assert.NoError(t, err)
		assert.True(t, stFeatValue == feat.Value)
	})

	t.Run("featureOne does not exist in standard flags but should be loaded", func(t *testing.T) {
		conf := []byte(`
[feature_toggles]
featureOne = true
`)
		setup(t, conf)
		feat, err := openfeature.GetApiInstance().GetClient().BooleanValueDetails(ctx, "featureOne", false, evalCtx)
		assert.NoError(t, err)
		assert.True(t, feat.Value)
	})

	t.Run("missing feature should return default evaluation value and an error", func(t *testing.T) {
		setup(t, []byte(``))
		missingFeature, err := openfeature.GetApiInstance().GetClient().BooleanValueDetails(ctx, "missingFeature", true, evalCtx)
		assert.Error(t, err)
		assert.True(t, missingFeature.Value)
		assert.Equal(t, openfeature.ErrorCode("FLAG_NOT_FOUND"), missingFeature.ErrorCode)
	})
}

func setup(t *testing.T, conf []byte) {
	t.Helper()
	cfg, err := setting.NewCfgFromBytes(conf)
	require.NoError(t, err)

	err = InitOpenFeatureWithCfg(cfg)
	require.NoError(t, err)
}

func Test_CompareStaticProviderWithFeatureManager(t *testing.T) {
	conf := []byte(`
[feature_toggles]
ABCD = true
`)

	cfg, err := setting.NewCfgFromBytes(conf)
	require.NoError(t, err)

	// InitOpenFeatureWithCfg needed to initialize OpenFeature with the static provider configuration,
	// so that StaticFlagEvaluator can use an open feature client.
	// In real scenarios, this would be done during server startup.
	err = InitOpenFeatureWithCfg(cfg)
	require.NoError(t, err)

	// Use StaticFlagEvaluator instead of OpenFeatureService for static evaluation
	staticEvaluator, err := CreateStaticEvaluator(cfg)
	require.NoError(t, err)

	ctx := openfeature.WithTransactionContext(context.Background(), openfeature.NewEvaluationContext("grafana", nil))
	allFlags, err := staticEvaluator.EvalAllFlags(ctx)
	require.NoError(t, err)

	openFeatureEnabledFlags := map[string]bool{}
	for _, flag := range allFlags.Flags {
		if v, ok := flag.Value.(bool); ok && v {
			openFeatureEnabledFlags[flag.Key] = true
		}
	}

	mgr, err := ProvideManagerService(setting.ProvideService(cfg))
	require.NoError(t, err)

	// compare enabled feature flags match between StaticFlagEvaluator and Feature Manager
	enabledFeatureManager := mgr.GetEnabled(ctx)
	assert.Equal(t, openFeatureEnabledFlags, enabledFeatureManager)
}

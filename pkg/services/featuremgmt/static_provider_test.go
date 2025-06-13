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
		p := provider(t, []byte(``))
		// Check for one of the standard flags
		feat, err := p.Client.BooleanValueDetails(ctx, stFeatName, !stFeatValue, evalCtx)
		assert.NoError(t, err)
		assert.True(t, stFeatValue == feat.Value)
	})

	t.Run("featureOne does not exist in standard flags but should be loaded", func(t *testing.T) {
		conf := []byte(`
[feature_toggles]
featureOne = true
`)
		p := provider(t, conf)
		feat, err := p.Client.BooleanValueDetails(ctx, "featureOne", false, evalCtx)
		assert.NoError(t, err)
		assert.True(t, feat.Value)
	})

	t.Run("missing feature should return default evaluation value and an error", func(t *testing.T) {
		p := provider(t, []byte(``))
		missingFeature, err := p.Client.BooleanValueDetails(ctx, "missingFeature", true, evalCtx)
		assert.Error(t, err)
		assert.True(t, missingFeature.Value)
		assert.Equal(t, openfeature.ErrorCode("FLAG_NOT_FOUND"), missingFeature.ErrorCode)
	})
}

func provider(t *testing.T, conf []byte) *OpenFeatureService {
	t.Helper()
	cfg, err := setting.NewCfgFromBytes(conf)
	require.NoError(t, err)

	p, err := ProvideOpenFeatureService(cfg)
	require.NoError(t, err)
	return p
}

func Test_CompareStaticProviderWithFeatureManager(t *testing.T) {
	cfg := setting.NewCfg()
	sec, err := cfg.Raw.NewSection("feature_toggles")
	require.NoError(t, err)
	_, err = sec.NewKey("ABCD", "true")
	require.NoError(t, err)

	p, err := ProvideOpenFeatureService(cfg)
	require.NoError(t, err)

	_, ok := p.provider.(*inMemoryBulkProvider)
	if !ok {
		t.Fatalf("expected inMemoryBulkProvider, got %T", p.provider)
	}

	ctx := openfeature.WithTransactionContext(context.Background(), openfeature.NewEvaluationContext("grafana", nil))
	allFlags, err := p.EvalAllFlagsWithStaticProvider(ctx)
	require.NoError(t, err)

	openFeatureEnabledFlags := map[string]bool{}
	for _, flag := range allFlags.Flags {
		if flag.Value {
			openFeatureEnabledFlags[flag.Key] = true
		}
	}

	mgr, err := ProvideManagerService(cfg)
	require.NoError(t, err)

	// compare enabled feature flags match between OpenFeature static provider and Feature Manager
	enabledFeatureManager := mgr.GetEnabled(ctx)
	assert.Equal(t, openFeatureEnabledFlags, enabledFeatureManager)
}

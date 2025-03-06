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

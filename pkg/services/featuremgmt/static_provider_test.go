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
	conf := []byte(`
[feature_toggles]
enable = featureOne, featureTwo
featureThree = true
featureFour = false

[feature_toggles.openfeature]
provider = static
instance_slug = grafana
`)
	cfg, err := setting.NewCfgFromBytes(conf)
	require.NoError(t, err)

	p, err := ProvideOpenFeatureManager(cfg)
	require.NoError(t, err)

	ctx := context.Background()
	evalCtx := openfeature.NewEvaluationContext("grafana", nil)

	featOne, err := p.Client.BooleanValueDetails(ctx, "featureOne", false, evalCtx)
	assert.NoError(t, err)
	assert.True(t, featOne.Value)

	featureTwo, err := p.Client.BooleanValueDetails(ctx, "featureTwo", false, evalCtx)
	assert.NoError(t, err)
	assert.True(t, featureTwo.Value)

	featureThree, err := p.Client.BooleanValueDetails(ctx, "featureThree", false, evalCtx)
	assert.NoError(t, err)
	assert.True(t, featureThree.Value)

	featureFour, err := p.Client.BooleanValueDetails(ctx, "featureFour", true, evalCtx)
	assert.NoError(t, err)
	assert.False(t, featureFour.Value)

	// since such a feature does not exist, evaluation should return default value and an error
	missingFeature, err := p.Client.BooleanValueDetails(ctx, "missingFeature", true, evalCtx)
	assert.Error(t, err)
	assert.True(t, missingFeature.Value)
	assert.Equal(t, openfeature.ErrorCode("FLAG_NOT_FOUND"), missingFeature.ErrorCode)
}

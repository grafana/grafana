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
		feat, err := openfeature.NewDefaultClient().BooleanValueDetails(ctx, stFeatName, !stFeatValue, evalCtx)
		assert.NoError(t, err)
		assert.True(t, stFeatValue == feat.Value)
	})

	t.Run("featureOne does not exist in standard flags but should be loaded", func(t *testing.T) {
		conf := []byte(`
[feature_toggles]
featureOne = true
`)
		setup(t, conf)
		feat, err := openfeature.NewDefaultClient().BooleanValueDetails(ctx, "featureOne", false, evalCtx)
		assert.NoError(t, err)
		assert.True(t, feat.Value)
	})

	t.Run("missing feature should return default evaluation value and an error", func(t *testing.T) {
		setup(t, []byte(``))
		missingFeature, err := openfeature.NewDefaultClient().BooleanValueDetails(ctx, "missingFeature", true, evalCtx)
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

	mgr, err := ProvideManagerService(cfg)
	require.NoError(t, err)

	// compare enabled feature flags match between StaticFlagEvaluator and Feature Manager
	enabledFeatureManager := mgr.GetEnabled(ctx)
	assert.Equal(t, openFeatureEnabledFlags, enabledFeatureManager)
}

func Test_StaticProvider_FailfastOnMismatchedType(t *testing.T) {
	staticFlags := map[string]setting.FeatureToggle{"oldBooleanFlag": {
		Type:  setting.Boolean,
		Name:  "oldBooleanFlag",
		Value: true,
	}}

	flag := FeatureFlag{
		Name:       "oldBooleanFlag",
		Expression: "1.0",
		Type:       Float,
	}
	_, err := newStaticProvider(staticFlags, []FeatureFlag{flag})
	assert.EqualError(t, err, "type mismatch for flag 'oldBooleanFlag' detected")
}

func Test_StaticProvider_TypedFlags(t *testing.T) {
	tests := []struct {
		flags         FeatureFlag
		defaultValue  any
		expectedValue any
	}{
		{
			flags: FeatureFlag{
				Name:       "Flag",
				Expression: "true",
				Type:       Boolean,
			},
			defaultValue:  false,
			expectedValue: true,
		},
		{
			flags: FeatureFlag{
				Name:       "Flag",
				Expression: "1.0",
				Type:       Float,
			},
			defaultValue:  0.0,
			expectedValue: 1.0,
		},
		{
			flags: FeatureFlag{
				Name:       "Flag",
				Expression: "blue",
				Type:       String,
			},
			defaultValue:  "red",
			expectedValue: "blue",
		},
		{
			flags: FeatureFlag{
				Name:       "Flag",
				Expression: "1",
				Type:       Integer,
			},
			defaultValue:  int64(0),
			expectedValue: int64(1),
		},
		{
			flags: FeatureFlag{
				Name:       "Flag",
				Expression: `{ "foo": "bar" }`,
				Type:       Structure,
			},
			defaultValue:  nil,
			expectedValue: map[string]any{"foo": "bar"},
		},
	}

	for _, tt := range tests {
		provider, err := newStaticProvider(nil, []FeatureFlag{tt.flags})
		assert.NoError(t, err)

		var result any
		switch tt.flags.Type {
		case Boolean:
			result = provider.BooleanEvaluation(t.Context(), tt.flags.Name, tt.defaultValue.(bool), openfeature.FlattenedContext{}).Value
		case Float:
			result = provider.FloatEvaluation(t.Context(), tt.flags.Name, tt.defaultValue.(float64), openfeature.FlattenedContext{}).Value
		case String:
			result = provider.StringEvaluation(t.Context(), tt.flags.Name, tt.defaultValue.(string), openfeature.FlattenedContext{}).Value
		case Integer:
			result = provider.IntEvaluation(t.Context(), tt.flags.Name, tt.defaultValue.(int64), openfeature.FlattenedContext{}).Value
		case Structure:
			result = provider.ObjectEvaluation(t.Context(), tt.flags.Name, tt.defaultValue, openfeature.FlattenedContext{}).Value
		}

		assert.Equal(t, tt.expectedValue, result)
	}
}
func Test_StaticProvider_ConfigOverride(t *testing.T) {
	tests := []struct {
		name          string
		typ           FeatureFlagType
		originalValue string
		configValue   any
	}{
		{
			name:          "bool",
			typ:           Boolean,
			originalValue: "false",
			configValue:   true,
		},
		{
			name:          "int",
			typ:           Integer,
			originalValue: "0",
			configValue:   int64(1),
		},
		{
			name:          "float",
			typ:           Float,
			originalValue: "0.0",
			configValue:   1.0,
		},
		{
			name:          "string",
			typ:           String,
			originalValue: "foo",
			configValue:   "bar",
		},
		{
			name:          "structure",
			typ:           Structure,
			originalValue: "{}",
			configValue:   make(map[string]any),
		},
	}

	for _, tt := range tests {
		configFlags, standardFlags := makeFlags(tt)
		provider, err := newStaticProvider(configFlags, standardFlags)
		assert.NoError(t, err)

		var result any
		switch tt.typ {
		case Boolean:
			result = provider.BooleanEvaluation(t.Context(), tt.name, false, openfeature.FlattenedContext{}).Value
		case Float:
			result = provider.FloatEvaluation(t.Context(), tt.name, 0.0, openfeature.FlattenedContext{}).Value
		case String:
			result = provider.StringEvaluation(t.Context(), tt.name, "foo", openfeature.FlattenedContext{}).Value
		case Integer:
			result = provider.IntEvaluation(t.Context(), tt.name, 1, openfeature.FlattenedContext{}).Value
		case Structure:
			result = provider.ObjectEvaluation(t.Context(), tt.name, make(map[string]any), openfeature.FlattenedContext{}).Value
		}

		assert.Equal(t, tt.configValue, result)
	}
}

func makeFlags(tt struct {
	name          string
	typ           FeatureFlagType
	originalValue string
	configValue   any
}) (map[string]setting.FeatureToggle, []FeatureFlag) {
	orig := FeatureFlag{
		Name:       tt.name,
		Expression: tt.originalValue,
		Type:       tt.typ,
	}

	config := map[string]setting.FeatureToggle{
		tt.name: {
			Name:  tt.name,
			Type:  setting.FeatureFlagType(tt.typ.String()),
			Value: tt.configValue,
		},
	}

	return config, []FeatureFlag{orig}
}

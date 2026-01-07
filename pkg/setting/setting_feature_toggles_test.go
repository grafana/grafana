package setting

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestFeatureToggles(t *testing.T) {
	testCases := []struct {
		name            string
		conf            map[string]string
		expectedToggles map[string]memprovider.InMemoryFlag
	}{
		{
			name: "can parse feature toggles passed in the `enable` array",
			conf: map[string]string{
				"enable": "feature1,feature2",
			},
			expectedToggles: map[string]memprovider.InMemoryFlag{
				"feature1": {Key: "feature1", Variants: map[string]any{"": true}},
				"feature2": {Key: "feature2", Variants: map[string]any{"": true}},
			},
		},
		{
			name: "can parse feature toggles listed under [feature_toggles]",
			conf: map[string]string{
				"enable":   "feature1,feature2",
				"feature3": "true",
			},
			expectedToggles: map[string]memprovider.InMemoryFlag{
				"feature1": {Key: "feature1", Variants: map[string]any{"": true}},
				"feature2": {Key: "feature2", Variants: map[string]any{"": true}},
				"feature3": {Key: "feature3", Variants: map[string]any{"": true}},
			},
		},
		{
			name: "toggles under [feature_toggles] overrides those in the array",
			conf: map[string]string{
				"enable":   "feature1,feature2",
				"feature2": "false",
			},
			expectedToggles: map[string]memprovider.InMemoryFlag{
				"feature1": {Key: "feature1", Variants: map[string]any{"": true}},
				"feature2": {Key: "feature2", Variants: map[string]any{"": false}},
			},
		},
		{
			name: "type of the feature flag is handled correctly",
			conf: map[string]string{
				"feature1": "1", "feature2": "1.0",
				"feature3": `{"foo":"bar"}`, "feature4": "bar",
				"feature5": "t", "feature6": "T",
			},
			expectedToggles: map[string]memprovider.InMemoryFlag{
				"feature1": {Key: "feature1", Variants: map[string]any{"": 1}},
				"feature2": {Key: "feature2", Variants: map[string]any{"": 1.0}},
				"feature3": {Key: "feature3", Variants: map[string]any{"": map[string]any{"foo": "bar"}}},
				"feature4": {Key: "feature4", Variants: map[string]any{"": "bar"}},
				"feature5": {Key: "feature5", Variants: map[string]any{"": true}},
				"feature6": {Key: "feature6", Variants: map[string]any{"": true}},
			},
		},
	}

	for _, tc := range testCases {
		f := ini.Empty()

		toggles, _ := f.NewSection("feature_toggles")
		for k, v := range tc.conf {
			_, err := toggles.NewKey(k, v)
			require.ErrorIs(t, err, nil)
		}

		featureToggles, err := ReadFeatureTogglesFromInitFile(toggles)
		require.NoError(t, err)

		for k, v := range featureToggles {
			toggle := tc.expectedToggles[k]
			require.Equal(t, toggle, v, tc.name)
		}
	}
}

func TestFlagValueSerialization(t *testing.T) {
	testCases := []memprovider.InMemoryFlag{
		{Key: "int", Variants: map[string]any{"": 1}},
		{Key: "1.0f", Variants: map[string]any{"": 1.0}},
		{Key: "1.01f", Variants: map[string]any{"": 1.01}},
		{Key: "1.10f", Variants: map[string]any{"": 1.10}},
		{Key: "struct", Variants: map[string]any{"": map[string]any{"foo": "bar"}}},
		{Key: "string", Variants: map[string]any{"": "bar"}},
		{Key: "true", Variants: map[string]any{"": true}},
		{Key: "false", Variants: map[string]any{"": false}},
	}

	for _, tt := range testCases {
		serialized := SerializeFlagValue(tt)
		deserialized, err := ParseFlag(tt.Key, serialized)
		assert.NoError(t, err)
		if diff := cmp.Diff(tt, deserialized); diff != "" {
			t.Errorf("(-want, +got) = %v", diff)
		}
	}
}

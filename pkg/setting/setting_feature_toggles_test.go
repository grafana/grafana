package setting

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestFeatureToggles(t *testing.T) {
	testCases := []struct {
		name            string
		conf            map[string]string
		err             error
		expectedToggles map[string]FeatureToggle
	}{
		{
			name: "can parse feature toggles passed in the `enable` array",
			conf: map[string]string{
				"enable": "feature1,feature2",
			},
			expectedToggles: map[string]FeatureToggle{
				"feature1": {Name: "feature1", Type: Boolean, Value: true},
				"feature2": {Name: "feature2", Type: Boolean, Value: true},
			},
		},
		{
			name: "can parse feature toggles listed under [feature_toggles]",
			conf: map[string]string{
				"enable":   "feature1,feature2",
				"feature3": "true",
			},
			expectedToggles: map[string]FeatureToggle{
				"feature1": {Name: "feature1", Type: Boolean, Value: true},
				"feature2": {Name: "feature2", Type: Boolean, Value: true},
				"feature3": {Name: "feature3", Type: Boolean, Value: true},
			},
		},
		{
			name: "toggles under [feature_toggles] overrides those in the array",
			conf: map[string]string{
				"enable":   "feature1,feature2",
				"feature2": "false",
			},
			expectedToggles: map[string]FeatureToggle{
				"feature1": {Name: "feature1", Type: Boolean, Value: true},
				"feature2": {Name: "feature2", Type: Boolean, Value: false},
			},
		},
		{
			name: "conflict in type declaration is be detected",
			conf: map[string]string{
				"enable":   "feature1,feature2",
				"feature2": "invalid",
			},
			expectedToggles: map[string]FeatureToggle{},
			err:             errors.New("type mismatch during flag declaration 'feature2': boolean, string"),
		},
		{
			name: "type of the feature flag is handled correctly",
			conf: map[string]string{
				"feature1": "1", "feature2": "1.0",
				"feature3": `{"foo":"bar"}`, "feature4": "bar",
				"feature5": "t", "feature6": "T",
			},
			expectedToggles: map[string]FeatureToggle{
				"feature1": {Name: "feature1", Type: Integer, Value: 1},
				"feature2": {Name: "feature2", Type: Float, Value: 1.0},
				"feature3": {Name: "feature3", Type: Structure, Value: map[string]any{"foo": "bar"}},
				"feature4": {Name: "feature4", Type: String, Value: "bar"},
				"feature5": {Name: "feature5", Type: Boolean, Value: true},
				"feature6": {Name: "feature6", Type: Boolean, Value: true},
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
		if tc.err != nil {
			require.EqualError(t, err, tc.err.Error())
		}

		if err == nil {
			for k, v := range featureToggles {
				toggle := tc.expectedToggles[k]
				require.Equal(t, toggle, v, tc.name)
			}
		}
	}
}

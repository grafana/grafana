package setting

import (
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestFeatureToggles(t *testing.T) {
	testCases := []struct {
		name            string
		conf            map[string]string
		err             error
		expectedToggles map[string]bool
	}{
		{
			name: "can parse feature toggles passed in the `enable` array",
			conf: map[string]string{
				"enable": "feature1,feature2",
			},
			expectedToggles: map[string]bool{
				"feature1": true,
				"feature2": true,
			},
		},
		{
			name: "can parse feature toggles listed under [feature_toggles]",
			conf: map[string]string{
				"enable":   "feature1,feature2",
				"feature3": "true",
			},
			expectedToggles: map[string]bool{
				"feature1": true,
				"feature2": true,
				"feature3": true,
			},
		},
		{
			name: "toggles under [feature_toggles] overrides those in the array",
			conf: map[string]string{
				"enable":   "feature1,feature2",
				"feature2": "false",
			},
			expectedToggles: map[string]bool{
				"feature1": true,
				"feature2": false,
			},
		},
		{
			name: "invalid boolean value should return syntax error",
			conf: map[string]string{
				"enable":   "feature1,feature2",
				"feature2": "invalid",
			},
			expectedToggles: map[string]bool{},
			err:             strconv.ErrSyntax,
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
		require.ErrorIs(t, err, tc.err)

		if err == nil {
			for k, v := range featureToggles {
				require.Equal(t, tc.expectedToggles[k], v, tc.name)
			}
		}
	}
}

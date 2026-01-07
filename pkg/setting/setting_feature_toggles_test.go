package setting

import (
	"testing"

	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestFeatureToggles(t *testing.T) {
	testCases := []struct {
		name            string
		conf            map[string]string
		err             error
		expectedToggles map[string]memprovider.InMemoryFlag
	}{
		{
			name: "can parse feature toggles passed in the `enable` array",
			conf: map[string]string{
				"enable": "feature1,feature2",
			},
			expectedToggles: map[string]memprovider.InMemoryFlag{
				"feature1": makeInMemoryFlag("feature1", true),
				"feature2": makeInMemoryFlag("feature2", true),
			},
		},
		{
			name: "can parse feature toggles listed under [feature_toggles]",
			conf: map[string]string{
				"enable":   "feature1,feature2",
				"feature3": "true",
			},
			expectedToggles: map[string]memprovider.InMemoryFlag{
				"feature1": makeInMemoryFlag("feature1", true),
				"feature2": makeInMemoryFlag("feature2", true),
				"feature3": makeInMemoryFlag("feature3", true),
			},
		},
		{
			name: "toggles under [feature_toggles] overrides those in the array",
			conf: map[string]string{
				"enable":   "feature1,feature2",
				"feature2": "false",
			},
			expectedToggles: map[string]memprovider.InMemoryFlag{
				"feature1": makeInMemoryFlag("feature1", true),
				"feature2": makeInMemoryFlag("feature2", false),
			},
		},
		//{
		//	name: "conflict in type declaration is be detected",
		//	conf: map[string]string{
		//		"enable":   "feature1,feature2",
		//		"feature2": "invalid",
		//	},
		//	expectedToggles: map[string]memprovider.InMemoryFlag{},
		//	err:             errors.New("type mismatch during flag declaration 'feature2': boolean, string"),
		//},
		{
			name: "type of the feature flag is handled correctly",
			conf: map[string]string{
				"feature1": "1", "feature2": "1.0",
				"feature3": `{"foo":"bar"}`, "feature4": "bar",
				"feature5": "t", "feature6": "T",
			},
			expectedToggles: map[string]memprovider.InMemoryFlag{
				"feature1": makeInMemoryFlag("feature1", 1),
				"feature2": makeInMemoryFlag("feature2", 1.0),
				"feature3": makeInMemoryFlag("feature3", map[string]any{"foo": "bar"}),
				"feature4": makeInMemoryFlag("feature4", "bar"),
				"feature5": makeInMemoryFlag("feature5", true),
				"feature6": makeInMemoryFlag("feature6", true),
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

func makeInMemoryFlag(name string, value any) memprovider.InMemoryFlag {
	return memprovider.InMemoryFlag{
		Key:            name,
		DefaultVariant: DefaultVariantName,
		Variants: map[string]any{
			DefaultVariantName: value,
		},
	}
}

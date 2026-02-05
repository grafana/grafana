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
		expectedToggles map[string]TypedFlag
	}{
		{
			name: "can parse feature toggles passed in the `enable` array",
			conf: map[string]string{
				"enable": "feature1,feature2",
			},
			expectedToggles: map[string]TypedFlag{
				"feature1": {InMemoryFlag: NewInMemoryFlag("feature1", true), Type: FlagTypeBoolean},
				"feature2": {InMemoryFlag: NewInMemoryFlag("feature2", true), Type: FlagTypeBoolean},
			},
		},
		{
			name: "can parse feature toggles listed under [feature_toggles]",
			conf: map[string]string{
				"enable":   "feature1,feature2",
				"feature3": "true",
			},
			expectedToggles: map[string]TypedFlag{
				"feature1": {InMemoryFlag: NewInMemoryFlag("feature1", true), Type: FlagTypeBoolean},
				"feature2": {InMemoryFlag: NewInMemoryFlag("feature2", true), Type: FlagTypeBoolean},
				"feature3": {InMemoryFlag: NewInMemoryFlag("feature3", true), Type: FlagTypeBoolean},
			},
		},
		{
			name: "toggles under [feature_toggles] overrides those in the array",
			conf: map[string]string{
				"enable":   "feature1,feature2",
				"feature2": "false",
			},
			expectedToggles: map[string]TypedFlag{
				"feature1": {InMemoryFlag: NewInMemoryFlag("feature1", true), Type: FlagTypeBoolean},
				"feature2": {InMemoryFlag: NewInMemoryFlag("feature2", false), Type: FlagTypeBoolean},
			},
		},
		{
			name: "feature flags of different types are handled correctly",
			conf: map[string]string{
				"feature1": "1",
				"feature2": "1.0",
				"feature3": `{"foo":"bar"}`,
				"feature4": "bar",
				"feature5": "t",
				"feature6": "T",
			},
			expectedToggles: map[string]TypedFlag{
				"feature1": {InMemoryFlag: NewInMemoryFlag("feature1", 1), Type: FlagTypeInteger},
				"feature2": {InMemoryFlag: NewInMemoryFlag("feature2", 1.0), Type: FlagTypeFloat},
				"feature3": {InMemoryFlag: NewInMemoryFlag("feature3", map[string]any{"foo": "bar"}), Type: FlagTypeObject},
				"feature4": {InMemoryFlag: NewInMemoryFlag("feature4", "bar"), Type: FlagTypeString},
				"feature5": {InMemoryFlag: NewInMemoryFlag("feature5", true), Type: FlagTypeBoolean},
				"feature6": {InMemoryFlag: NewInMemoryFlag("feature6", true), Type: FlagTypeBoolean},
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

		typedFlags, err := ReadFeatureTogglesFromInitFile(toggles)
		require.NoError(t, err)

		for k, expectedFlag := range tc.expectedToggles {
			actualFlag := typedFlags[k]
			require.Equal(t, expectedFlag, actualFlag, tc.name)
		}
	}
}

func TestFlagValueSerialization(t *testing.T) {
	testCases := []memprovider.InMemoryFlag{
		NewInMemoryFlag("int", 1),
		NewInMemoryFlag("1.0f", 1.0),
		NewInMemoryFlag("1.01f", 1.01),
		NewInMemoryFlag("1.10f", 1.10),
		NewInMemoryFlag("struct", map[string]any{"foo": "bar"}),
		NewInMemoryFlag("string", "bar"),
		NewInMemoryFlag("true", true),
		NewInMemoryFlag("false", false),
	}

	for _, tt := range testCases {
		// Wrap InMemoryFlag in TypedFlag (Type field doesn't affect serialization)
		typedFlag := TypedFlag{InMemoryFlag: tt, Type: FlagTypeString}
		asStringMap := AsStringMap(map[string]TypedFlag{tt.Key: typedFlag})

		deserialized, _, err := ParseFlagWithType(tt.Key, asStringMap[tt.Key])
		assert.NoError(t, err)

		if diff := cmp.Diff(tt, deserialized); diff != "" {
			t.Errorf("(-want, +got) = %v", diff)
		}
	}
}

package featuremgmt

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"

	gofeatureflag "github.com/open-feature/go-sdk-contrib/providers/go-feature-flag/pkg"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProvideOpenFeatureManager(t *testing.T) {
	testCases := []struct {
		name             string
		cfg              string
		expectedProvider string
	}{
		{
			name:             "static provider",
			expectedProvider: staticProviderType,
		},
		{
			name: "goff provider",
			cfg: `
[feature_toggles.openfeature]
provider = goff
url = http://localhost:1031
targetingKey = grafana
`,
			expectedProvider: goffProviderType,
		},
		{
			name: "invalid provider",
			cfg: `
[feature_toggles.openfeature]
provider = some_provider
`,
			expectedProvider: staticProviderType,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			if tc.cfg != "" {
				err := cfg.Raw.Append([]byte(tc.cfg))
				require.NoError(t, err)
			}

			p, err := ProvideOpenFeatureService(cfg)
			require.NoError(t, err)

			if tc.expectedProvider == goffProviderType {
				_, ok := p.provider.(*gofeatureflag.Provider)
				assert.True(t, ok, "expected provider to be of type goff.Provider")
			} else {
				_, ok := p.provider.(memprovider.InMemoryProvider)
				assert.True(t, ok, "expected provider to be of type memprovider.InMemoryProvider")
			}
		})
	}
}

func Test_CtxAttrs(t *testing.T) {
	testCases := []struct {
		name     string
		conf     string
		expected map[string]any
	}{
		{
			name: "empty config - only default attributes should be present",
			expected: map[string]any{
				"grafana_version": "",
			},
		},
		{
			name: "config with some attributes",
			conf: `
[feature_toggles.openfeature.context]
foo = bar
baz = qux
quux = corge`,
			expected: map[string]any{
				"foo":             "bar",
				"baz":             "qux",
				"quux":            "corge",
				"grafana_version": "",
			},
		},
		{
			name: "config with an attribute that overrides a default one",
			conf: `
[feature_toggles.openfeature.context]
grafana_version = 10.0.0
foo = bar`,
			expected: map[string]any{
				"grafana_version": "10.0.0",
				"foo":             "bar",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg, err := setting.NewCfgFromBytes([]byte(tc.conf))
			require.NoError(t, err)

			assert.Equal(t, tc.expected, ctxAttrs(cfg))
		})
	}
}

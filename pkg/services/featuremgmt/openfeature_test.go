package featuremgmt

import (
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/setting"

	gofeatureflag "github.com/open-feature/go-sdk-contrib/providers/go-feature-flag/pkg"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProvideOpenFeatureManager(t *testing.T) {
	u, err := url.Parse("http://localhost:1031")
	require.NoError(t, err)

	testCases := []struct {
		name             string
		cfg              setting.OpenFeatureSettings
		expectedProvider string
	}{
		{
			name:             "static provider",
			expectedProvider: setting.StaticProviderType,
		},
		{
			name: "goff provider",
			cfg: setting.OpenFeatureSettings{
				ProviderType: setting.GOFFProviderType,
				URL:          u,
				TargetingKey: "grafana",
			},
			expectedProvider: setting.GOFFProviderType,
		},
		{
			name: "invalid provider",
			cfg: setting.OpenFeatureSettings{
				ProviderType: "some_provider",
			},
			expectedProvider: setting.StaticProviderType,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.OpenFeature = tc.cfg

			p, err := ProvideOpenFeatureService(cfg)
			require.NoError(t, err)

			if tc.expectedProvider == setting.GOFFProviderType {
				_, ok := p.provider.(*gofeatureflag.Provider)
				assert.True(t, ok, "expected provider to be of type goff.Provider")
			} else {
				_, ok := p.provider.(*inMemoryBulkProvider)
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

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

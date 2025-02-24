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
url = "http://localhost:1031"
instance_slug = "slug"
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

			p, err := ProvideOpenFeatureManager(cfg)
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

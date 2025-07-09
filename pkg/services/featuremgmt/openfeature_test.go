package featuremgmt

import (
	"context"
	"net/url"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/clientauth/middleware"
	"github.com/grafana/grafana/pkg/setting"

	gofeatureflag "github.com/open-feature/go-sdk-contrib/providers/go-feature-flag/pkg"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"
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

	httpClientProvider := httpclient.NewProvider()
	// If we want to test with the real token exchange client, we can use the following code
	/* cfg := setting.NewCfg()
	section := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	section.Key("token").SetValue("test")
	section.Key("token_exchange_url").SetValue("http://token-endpoint/sign-access-token") */
	staticSignerMiddlewareProvider, err := middleware.NewTestCloudAccessPolicyTokenSignerMiddlewareProvider()
	require.NoError(t, err)

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.OpenFeature = tc.cfg

			p, err := ProvideOpenFeatureService(cfg, httpClientProvider, staticSignerMiddlewareProvider)
			require.NoError(t, err)

			if tc.expectedProvider == setting.GOFFProviderType {
				_, ok := p.provider.(*gofeatureflag.Provider)
				assert.True(t, ok, "expected provider to be of type goff.Provider")
				client, err := createClient(p.provider)
				assert.NoError(t, err)
				ctx := request.WithNamespace(context.Background(), "stacks-1")
				_ = client.Boolean(ctx, "test", false, openfeature.NewEvaluationContext("test", map[string]interface{}{"test": "test"}))
			} else {
				_, ok := p.provider.(*inMemoryBulkProvider)
				assert.True(t, ok, "expected provider to be of type memprovider.InMemoryProvider")
			}
		})
	}
}

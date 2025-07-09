package featuremgmt

import (
	"context"
	"errors"
	"net/url"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/clientauth/middleware"
	"github.com/grafana/grafana/pkg/setting"

	authlib "github.com/grafana/authlib/authn"
	gofeatureflag "github.com/open-feature/go-sdk-contrib/providers/go-feature-flag/pkg"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestProvideOpenFeatureManager(t *testing.T) {
	u, err := url.Parse("http://localhost:1031")
	require.NoError(t, err)

	testCases := []struct {
		name                  string
		cfg                   setting.OpenFeatureSettings
		expectedProvider      string
		expectExchangeRequest *authlib.TokenExchangeRequest
		failSigning           bool
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
			expectExchangeRequest: &authlib.TokenExchangeRequest{
				Namespace: "*",
				Audiences: []string{"features.grafana.app"},
			},
			expectedProvider: setting.GOFFProviderType,
		},
		{
			name: "goff provider with failing token exchange",
			cfg: setting.OpenFeatureSettings{
				ProviderType: setting.GOFFProviderType,
				URL:          u,
				TargetingKey: "grafana",
			},
			failSigning: true,
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
	require.NoError(t, err)

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.OpenFeature = tc.cfg

			var tokenExchangeClient *fakeTokenExchangeClient

			if tc.expectExchangeRequest != nil {
				tokenExchangeClient = &fakeTokenExchangeClient{
					Mock: &mock.Mock{
						ExpectedCalls: []*mock.Call{
							{
								Method:    "Exchange",
								Arguments: mock.Arguments{mock.Anything, *tc.expectExchangeRequest},
							},
						},
					},
				}

				if tc.failSigning {
					tokenExchangeClient.expectedErr = errors.New("failed signing access token")
				}
			}

			tokenExchangeMiddleware := middleware.TestingTokenExchangeMiddleware(tokenExchangeClient)
			p, err := ProvideOpenFeatureService(cfg, httpClientProvider, tokenExchangeMiddleware)
			require.NoError(t, err)

			if tc.expectedProvider == setting.GOFFProviderType {
				goffProvider, ok := p.provider.(*gofeatureflag.Provider)
				assert.True(t, ok, "expected provider to be of type goff.Provider")

				testGoFFProvider(t, goffProvider, tc.failSigning)
			} else {
				_, ok := p.provider.(*inMemoryBulkProvider)
				assert.True(t, ok, "expected provider to be of type memprovider.InMemoryProvider")
			}
		})
	}
}

func testGoFFProvider(t *testing.T, provider *gofeatureflag.Provider, failSigning bool) {
	client, err := createClient(provider)
	assert.NoError(t, err)

	// this tests with a fake identity with * namespace access, but in any case, it proves what the requester
	// is scoped to is what is used to sign the token with
	ctx, _ := identity.WithServiceIdentity(context.Background(), 1)
	_ = client.Boolean(ctx, "test", false, openfeature.NewEvaluationContext("test", map[string]interface{}{"test": "test"}))
}

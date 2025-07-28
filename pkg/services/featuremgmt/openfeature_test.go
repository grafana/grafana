package featuremgmt

import (
	"context"
	"errors"
	"net/url"
	"testing"

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

func TestCreateProvider(t *testing.T) {
	u, err := url.Parse("http://localhost:10333")
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
			expectExchangeRequest: &authlib.TokenExchangeRequest{
				Namespace: "*",
				Audiences: []string{"features.grafana.app"},
			},
			expectedProvider: setting.GOFFProviderType,
			failSigning:      true,
		},
		{
			name: "invalid provider",
			cfg: setting.OpenFeatureSettings{
				ProviderType: "some_provider",
			},
			expectedProvider: setting.StaticProviderType,
		},
	}

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
			goffClient, err := goffHTTPClient(tokenExchangeMiddleware)
			require.NoError(t, err, "failed to create goff http client")
			provider, err := createProvider(tc.cfg.ProviderType, tc.cfg.URL, nil, goffClient)
			require.NoError(t, err)

			err = openfeature.SetProviderAndWait(provider)
			require.NoError(t, err, "failed to set provider")

			if tc.expectedProvider == setting.GOFFProviderType {
				_, ok := provider.(*gofeatureflag.Provider)
				assert.True(t, ok, "expected provider to be of type goff.Provider")

				testGoFFProvider(t, tc.failSigning)
			} else {
				_, ok := provider.(*inMemoryBulkProvider)
				assert.True(t, ok, "expected provider to be of type memprovider.InMemoryProvider")
			}
		})
	}
}

func testGoFFProvider(t *testing.T, failSigning bool) {
	// this tests with a fake identity with * namespace access, but in any case, it proves what the requester
	// is scoped to is what is used to sign the token with
	ctx, _ := identity.WithServiceIdentity(context.Background(), 1)

	// Test that the flag evaluation can be attempted (though it will fail due to non-existent service)
	// The important thing is that the authentication middleware is properly integrated
	_, err := openfeature.GetApiInstance().GetClient().BooleanValueDetails(ctx, "test", false, openfeature.NewEvaluationContext("test", map[string]interface{}{"test": "test"}))

	// Error related to the token exchange should be returned if signing fails
	// otherwise, it should return a connection refused error since the goff URL is not set
	if failSigning {
		assert.ErrorContains(t, err, "failed to exchange token: error signing token", "should return an error when signing fails")
	} else {
		assert.ErrorContains(t, err, "connect: connection refused", "should return an error when goff url is not set")
	}
}

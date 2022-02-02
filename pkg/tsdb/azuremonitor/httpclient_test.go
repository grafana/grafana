package azuremonitor

import (
	"crypto/tls"
	"net/http"
	"testing"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHttpClient_Middlewares(t *testing.T) {
	tests := []struct {
		name                string
		route               azRoute
		model               datasourceInfo
		expectedMiddlewares int
		Err                 require.ErrorAssertionFunc
	}{
		{
			name: "creates an HTTP client with a middleware due to an app key",
			route: azRoute{
				URL:    azAppInsights.URL,
				Scopes: []string{},
			},
			model: datasourceInfo{
				Credentials: &azcredentials.AzureClientSecretCredentials{},
				DecryptedSecureJSONData: map[string]string{
					"appInsightsApiKey": "foo",
				},
			},
			expectedMiddlewares: 1,
			Err:                 require.NoError,
		},
		{
			name: "creates an HTTP client without a middleware",
			route: azRoute{
				URL:    "http://route",
				Scopes: []string{},
			},
			model: datasourceInfo{
				Credentials: &azcredentials.AzureClientSecretCredentials{},
			},
			expectedMiddlewares: 0,
			Err:                 require.NoError,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m, err := getMiddlewares(tt.route, tt.model)
			require.NoError(t, err)

			// Cannot test that the cli middleware works properly since the azcore sdk
			// rejects the TLS certs (if provided)
			if len(m) != tt.expectedMiddlewares {
				t.Errorf("Unexpected middlewares: %v", m)
			}
		})
	}
}

func TestHttpClient_AzureCredentials(t *testing.T) {
	model := datasourceInfo{
		Credentials: &azcredentials.AzureManagedIdentityCredentials{},
	}

	provider := &fakeHttpClientProvider{}

	t.Run("should have Azure credentials when scopes provided", func(t *testing.T) {
		route := azRoute{
			URL:    azAppInsights.URL,
			Scopes: []string{"https://management.azure.com/.default"},
		}

		_, err := newHTTPClient(route, model, provider)
		require.NoError(t, err)

		assert.NotNil(t, provider.opts)
		assert.NotNil(t, provider.opts.CustomOptions)

		assert.Contains(t, provider.opts.CustomOptions, "_azureCredentials")
		assert.Contains(t, provider.opts.CustomOptions, "_azureScopes")

		assert.Equal(t, model.Credentials, provider.opts.CustomOptions["_azureCredentials"])
		assert.Equal(t, route.Scopes, provider.opts.CustomOptions["_azureScopes"])
	})

	t.Run("should not have Azure credentials when scopes are not provided", func(t *testing.T) {
		route := azRoute{
			URL:    azAppInsights.URL,
			Scopes: []string{},
		}

		_, err := newHTTPClient(route, model, provider)
		require.NoError(t, err)

		assert.NotNil(t, provider.opts)

		if provider.opts.CustomOptions != nil {
			assert.NotContains(t, provider.opts.CustomOptions, "_azureCredentials")
			assert.NotContains(t, provider.opts.CustomOptions, "_azureScopes")
		}
	})
}

type fakeHttpClientProvider struct {
	httpclient.Provider

	opts sdkhttpclient.Options
}

func (p *fakeHttpClientProvider) New(opts ...sdkhttpclient.Options) (*http.Client, error) {
	p.opts = opts[0]
	return nil, nil
}

func (p *fakeHttpClientProvider) GetTransport(opts ...sdkhttpclient.Options) (http.RoundTripper, error) {
	p.opts = opts[0]
	return nil, nil
}

func (p *fakeHttpClientProvider) GetTLSConfig(opts ...sdkhttpclient.Options) (*tls.Config, error) {
	p.opts = opts[0]
	return nil, nil
}

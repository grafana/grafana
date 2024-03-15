package azuremonitor

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/grafana/grafana-azure-sdk-go/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHttpClient_AzureCredentials(t *testing.T) {
	model := types.DatasourceInfo{
		Credentials: &azcredentials.AzureManagedIdentityCredentials{},
	}

	jsonData, _ := json.Marshal(map[string]any{
		"httpHeaderName1": "GrafanaHeader",
	})
	settings := &backend.DataSourceInstanceSettings{
		JSONData: jsonData,
		DecryptedSecureJSONData: map[string]string{
			"httpHeaderValue1": "GrafanaValue",
		},
	}

	azureSettings := &azsettings.AzureSettings{
		Cloud: azsettings.AzurePublic,
	}
	provider := &fakeHttpClientProvider{}

	t.Run("should have Azure middleware when scopes provided", func(t *testing.T) {
		route := types.AzRoute{
			Scopes: []string{"https://management.azure.com/.default"},
		}

		_, err := newHTTPClient(context.Background(), route, model, settings, azureSettings, provider)
		require.NoError(t, err)

		require.NotNil(t, provider.opts)
		require.NotNil(t, provider.opts.Middlewares)
		assert.Len(t, provider.opts.Middlewares, 1)
	})

	t.Run("should not have Azure middleware when scopes are not provided", func(t *testing.T) {
		route := types.AzRoute{
			Scopes: []string{},
		}

		_, err := newHTTPClient(context.Background(), route, model, settings, azureSettings, provider)
		require.NoError(t, err)

		assert.NotNil(t, provider.opts)

		if provider.opts.Middlewares != nil {
			assert.Len(t, provider.opts.Middlewares, 0)
		}
	})

	t.Run("should combine custom azure and custom grafana headers", func(t *testing.T) {
		route := types.AzRoute{
			Headers: map[string]string{
				"AzureHeader": "AzureValue",
			},
		}

		res := http.Header{
			"Grafanaheader": {"GrafanaValue"},
			"Azureheader":   {"AzureValue"},
		}
		_, err := newHTTPClient(context.Background(), route, model, settings, azureSettings, provider)
		require.NoError(t, err)

		assert.NotNil(t, provider.opts)

		if provider.opts.Header != nil {
			assert.Len(t, provider.opts.Header, 2)
			assert.Equal(t, res, provider.opts.Header)
		}
	})
}

type fakeHttpClientProvider struct {
	httpclient.Provider

	opts httpclient.Options
}

func (p *fakeHttpClientProvider) New(opts ...httpclient.Options) (*http.Client, error) {
	p.opts = opts[0]
	return nil, nil
}

func (p *fakeHttpClientProvider) GetTransport(opts ...httpclient.Options) (http.RoundTripper, error) {
	p.opts = opts[0]
	return nil, nil
}

func (p *fakeHttpClientProvider) GetTLSConfig(opts ...httpclient.Options) (*tls.Config, error) {
	p.opts = opts[0]
	return nil, nil
}

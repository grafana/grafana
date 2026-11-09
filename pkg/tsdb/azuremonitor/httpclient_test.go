package azuremonitor

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"io"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
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

// countingRoundTripper records whether the Azure middleware forwarded a request.
// A rejected host must never reach it, because that is where the bearer token would be sent.
type countingRoundTripper struct {
	mu    sync.Mutex
	calls int
}

func (c *countingRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	c.mu.Lock()
	c.calls++
	c.mu.Unlock()
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(http.NoBody),
		Header:     make(http.Header),
		Request:    req,
	}, nil
}

func (c *countingRoundTripper) callCount() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.calls
}

// middlewareHTTPClientProvider builds a client that runs the same middleware chain as production.
type middlewareHTTPClientProvider struct {
	transport *countingRoundTripper
}

func (p *middlewareHTTPClientProvider) New(opts ...httpclient.Options) (*http.Client, error) {
	next := http.RoundTripper(p.transport)
	for i := len(opts[0].Middlewares) - 1; i >= 0; i-- {
		next = opts[0].Middlewares[i].CreateMiddleware(opts[0], next)
	}
	return &http.Client{Transport: next}, nil
}

func (p *middlewareHTTPClientProvider) GetTransport(opts ...httpclient.Options) (http.RoundTripper, error) {
	return p.transport, nil
}

func (p *middlewareHTTPClientProvider) GetTLSConfig(opts ...httpclient.Options) (*tls.Config, error) {
	return nil, nil
}

func TestHTTPClient_RejectsRequestToUnlistedHost(t *testing.T) {
	const routeURL = "https://management.azure.com"
	tests := []struct {
		name string
		url  string
	}{
		{name: "unrelated host", url: "https://evil.tld/subscriptions/x/providers/microsoft.insights/transactions/op"},
		{name: "azure host as a child of an attacker domain", url: "https://management.azure.com.evil.tld/subscriptions/x"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			transport := &countingRoundTripper{}
			client := azureHTTPClientForRoute(t, routeURL, transport)

			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, tt.url, nil)
			require.NoError(t, err)

			resp, err := client.Do(req)
			if resp != nil {
				defer func() { _ = resp.Body.Close() }()
			}
			require.ErrorContains(t, err, "not allowed by the datasource")
			require.Zero(t, transport.callCount(), "Azure token must not be sent to an unlisted host")
		})
	}
}

func TestHTTPClient_AllowsConfiguredRouteHost(t *testing.T) {
	const routeURL = "https://management.azure.com"
	transport := &countingRoundTripper{}
	client := azureHTTPClientForRoute(t, routeURL, transport)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, routeURL+"/subscriptions/x", nil)
	require.NoError(t, err)

	resp, err := client.Do(req)
	if resp != nil {
		defer func() { _ = resp.Body.Close() }()
	}
	if err != nil {
		require.NotContains(t, err.Error(), "not allowed by the datasource")
	}
}

func TestHTTPClient_AllowsRegionalMetricsHost(t *testing.T) {
	const routeURL = "https://metrics.monitor.azure.com"
	transport := &countingRoundTripper{}
	client := azureHTTPClientForRoute(t, routeURL, transport)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://westus2.metrics.monitor.azure.com/subscriptions/x/metrics:getBatch", nil)
	require.NoError(t, err)

	resp, err := client.Do(req)
	if resp != nil {
		defer func() { _ = resp.Body.Close() }()
	}
	if err != nil {
		require.NotContains(t, err.Error(), "not allowed by the datasource")
	}
}

func azureHTTPClientForRoute(t *testing.T, routeURL string, transport *countingRoundTripper) *http.Client {
	t.Helper()

	model := types.DatasourceInfo{
		Credentials: &azcredentials.AzureClientSecretCredentials{
			AzureCloud:   azsettings.AzurePublic,
			TenantId:     "tenant",
			ClientId:     "client",
			ClientSecret: "secret",
		},
	}
	settings := &backend.DataSourceInstanceSettings{}
	azureSettings := &azsettings.AzureSettings{Cloud: azsettings.AzurePublic}
	provider := &middlewareHTTPClientProvider{transport: transport}

	client, err := newHTTPClient(context.Background(), types.AzRoute{
		URL:    routeURL,
		Scopes: []string{routeURL + "/.default"},
	}, model, settings, azureSettings, provider)
	require.NoError(t, err)
	require.NotNil(t, client)
	return client
}

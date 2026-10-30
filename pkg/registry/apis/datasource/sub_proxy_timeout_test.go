package datasource

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/setting"
)

type timeoutCapturingProvider struct {
	timeout time.Duration
}

func (p *timeoutCapturingProvider) New(...sdkhttpclient.Options) (*http.Client, error) {
	return nil, fmt.Errorf("not used")
}

func (p *timeoutCapturingProvider) GetTransport(opts ...sdkhttpclient.Options) (http.RoundTripper, error) {
	p.timeout = opts[0].Timeouts.Timeout
	return roundTripperFunc(func(*http.Request) (*http.Response, error) {
		return nil, fmt.Errorf("datasource request failed: %w", context.DeadlineExceeded)
	}), nil
}

func (p *timeoutCapturingProvider) GetTLSConfig(...sdkhttpclient.Options) (*tls.Config, error) {
	return nil, fmt.Errorf("not used")
}

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) { return f(req) }

func TestSubProxyREST_Timeouts(t *testing.T) {
	for _, tc := range []struct {
		desc     string
		jsonData string
		deps     time.Duration
		expected time.Duration
	}{
		{desc: "defaults to 60 seconds", jsonData: `{}`, expected: 60 * time.Second},
		{desc: "uses the configured dataproxy timeout", jsonData: `{}`, deps: 15 * time.Second, expected: 15 * time.Second},
		{desc: "prefers the datasource timeout", jsonData: `{"timeout":90}`, deps: 15 * time.Second, expected: 90 * time.Second},
		{desc: "accepts a datasource timeout string", jsonData: `{"timeout":"120"}`, expected: 120 * time.Second},
		{desc: "ignores an unusable datasource timeout", jsonData: `{"timeout":"soon"}`, expected: 60 * time.Second},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			ds := &datasourceV0.DataSource{}
			ds.Spec.SetURL("http://upstream.invalid")
			provider := &proxyMockDatasourceProvider{ds: ds}
			provider.instanceSettings = &backend.DataSourceInstanceSettings{
				UID: "test-ds", Type: "test", URL: "http://upstream.invalid", JSONData: []byte(tc.jsonData),
			}
			builder := newProxyTestBuilder(provider)
			deps, err := builder.proxyDependencies(t.Context(), nil)
			require.NoError(t, err)
			clients := &timeoutCapturingProvider{}
			withTimeout := *deps
			withTimeout.HTTPClientProvider = clients
			withTimeout.Timeout = tc.deps
			builder.proxyDependencies = func(context.Context, *http.Request) (*ProxyDependencies, error) {
				return &withTimeout, nil
			}
			storage := &subProxyREST{builder: builder, transports: newProxyTransportCache()}
			t.Cleanup(storage.Destroy)

			handler, err := storage.Connect(proxyTestContext(), "test-ds", nil, &resourceMockResponder{})
			require.NoError(t, err)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/datasources/test-ds/proxy/api/v1/query", nil))

			require.Equal(t, tc.expected, clients.timeout)
			require.Equal(t, http.StatusGatewayTimeout, rec.Code)
		})
	}
}

func TestProxyTimeoutFromConfig(t *testing.T) {
	cfg := setting.NewCfg()
	require.Equal(t, 60*time.Second, ProxyTimeoutFromConfig(cfg))

	cfg.DataProxyTimeout = 45
	require.Equal(t, 60*time.Second, ProxyTimeoutFromConfig(cfg), "an unset key keeps the default")

	cfg.DataProxyTimeoutConfigured = true
	require.Equal(t, 45*time.Second, ProxyTimeoutFromConfig(cfg))
}

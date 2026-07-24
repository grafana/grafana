package httpclientprovider

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/proxy"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
)

func TestDataSourceMetricsMiddleware(t *testing.T) {
	t.Run("Without label options set should return next http.RoundTripper", func(t *testing.T) {
		origExecuteMiddlewareFunc := executeMiddlewareFunc
		executeMiddlewareCalled := false
		middlewareCalled := false
		executeMiddlewareFunc = func(next http.RoundTripper, datasourceLabel prometheus.Labels) http.RoundTripper {
			executeMiddlewareCalled = true
			return httpclient.RoundTripperFunc(func(r *http.Request) (*http.Response, error) {
				middlewareCalled = true
				return next.RoundTrip(r)
			})
		}
		t.Cleanup(func() {
			executeMiddlewareFunc = origExecuteMiddlewareFunc
		})

		ctx := &testContext{}
		finalRoundTripper := ctx.createRoundTripper("finalrt")
		mw := DataSourceMetricsMiddleware()
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, DataSourceMetricsMiddlewareName, middlewareName.MiddlewareName())

		req, err := http.NewRequest(http.MethodGet, "http://", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}
		require.Len(t, ctx.callChain, 1)
		require.ElementsMatch(t, []string{"finalrt"}, ctx.callChain)
		require.False(t, executeMiddlewareCalled)
		require.False(t, middlewareCalled)
	})

	t.Run("Without data source name label options set should return next http.RoundTripper", func(t *testing.T) {
		origExecuteMiddlewareFunc := executeMiddlewareFunc
		executeMiddlewareCalled := false
		middlewareCalled := false
		executeMiddlewareFunc = func(next http.RoundTripper, datasourceLabel prometheus.Labels) http.RoundTripper {
			executeMiddlewareCalled = true
			return httpclient.RoundTripperFunc(func(r *http.Request) (*http.Response, error) {
				middlewareCalled = true
				return next.RoundTrip(r)
			})
		}
		t.Cleanup(func() {
			executeMiddlewareFunc = origExecuteMiddlewareFunc
		})

		ctx := &testContext{}
		finalRoundTripper := ctx.createRoundTripper("finalrt")
		mw := DataSourceMetricsMiddleware()
		rt := mw.CreateMiddleware(httpclient.Options{Labels: map[string]string{"test": "test"}}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, DataSourceMetricsMiddlewareName, middlewareName.MiddlewareName())

		req, err := http.NewRequest(http.MethodGet, "http://", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}
		require.Len(t, ctx.callChain, 1)
		require.ElementsMatch(t, []string{"finalrt"}, ctx.callChain)
		require.False(t, executeMiddlewareCalled)
		require.False(t, middlewareCalled)
	})

	t.Run("With datasource name label options set should execute middleware", func(t *testing.T) {
		origExecuteMiddlewareFunc := executeMiddlewareFunc
		executeMiddlewareCalled := false
		labels := prometheus.Labels{}
		middlewareCalled := false
		executeMiddlewareFunc = func(next http.RoundTripper, datasourceLabel prometheus.Labels) http.RoundTripper {
			executeMiddlewareCalled = true
			labels = datasourceLabel
			return httpclient.RoundTripperFunc(func(r *http.Request) (*http.Response, error) {
				middlewareCalled = true
				return next.RoundTrip(r)
			})
		}
		t.Cleanup(func() {
			executeMiddlewareFunc = origExecuteMiddlewareFunc
		})

		testCases := []struct {
			description                       string
			httpClientOptions                 httpclient.Options
			expectedSecureSocksDSProxyEnabled string
		}{
			{
				description: "secure socks ds proxy is disabled",
				httpClientOptions: httpclient.Options{
					Labels: map[string]string{"datasource_name": "My Data Source 123", "datasource_type": "prometheus"},
				},
				expectedSecureSocksDSProxyEnabled: "false",
			},
			{
				description: "secure socks ds proxy is enabled",
				httpClientOptions: httpclient.Options{
					Labels:       map[string]string{"datasource_name": "My Data Source 123", "datasource_type": "prometheus"},
					ProxyOptions: &proxy.Options{Enabled: true},
				},
				expectedSecureSocksDSProxyEnabled: "true",
			},
		}

		for _, tt := range testCases {
			t.Run(tt.description, func(t *testing.T) {
				ctx := &testContext{}
				finalRoundTripper := ctx.createRoundTripper("finalrt")
				mw := DataSourceMetricsMiddleware()
				rt := mw.CreateMiddleware(tt.httpClientOptions, finalRoundTripper)
				require.NotNil(t, rt)
				middlewareName, ok := mw.(httpclient.MiddlewareName)
				require.True(t, ok)
				require.Equal(t, DataSourceMetricsMiddlewareName, middlewareName.MiddlewareName())

				req, err := http.NewRequest(http.MethodGet, "http://", nil)
				require.NoError(t, err)
				res, err := rt.RoundTrip(req)
				require.NoError(t, err)
				require.NotNil(t, res)
				if res.Body != nil {
					require.NoError(t, res.Body.Close())
				}
				require.Len(t, ctx.callChain, 1)
				require.ElementsMatch(t, []string{"finalrt"}, ctx.callChain)
				require.True(t, executeMiddlewareCalled)
				require.Len(t, labels, 3)
				require.Equal(t, "My_Data_Source_123", labels["datasource"])
				require.Equal(t, "prometheus", labels["datasource_type"])
				require.Equal(t, tt.expectedSecureSocksDSProxyEnabled, labels["secure_socks_ds_proxy_enabled"])
				require.True(t, middlewareCalled)
			})
		}
	})
}

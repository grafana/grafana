package httpclientprovider

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
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
		datasourceLabels := prometheus.Labels{}
		middlewareCalled := false
		executeMiddlewareFunc = func(next http.RoundTripper, datasourceLabel prometheus.Labels) http.RoundTripper {
			executeMiddlewareCalled = true
			datasourceLabels = datasourceLabel
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
		rt := mw.CreateMiddleware(httpclient.Options{Labels: map[string]string{"datasource_name": "My Data Source 123"}}, finalRoundTripper)
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
		require.Len(t, datasourceLabels, 1)
		require.Equal(t, "My_Data_Source_123", datasourceLabels["datasource"])
		require.True(t, middlewareCalled)
	})
}

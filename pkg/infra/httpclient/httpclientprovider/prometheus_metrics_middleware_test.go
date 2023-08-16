package httpclientprovider

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
)

func TestPrometheusMetricsMiddleware(t *testing.T) {
	noOpHandlerFunc := func(writer http.ResponseWriter, request *http.Request) {}

	for _, tc := range []struct {
		name    string
		handler http.HandlerFunc
		assert  func(t *testing.T, metrics *PrometheusMetrics)
	}{
		{
			name: "successful",
			assert: func(t *testing.T, metrics *PrometheusMetrics) {
				require.Equal(t, float64(0), testutil.ToFloat64(metrics.inFlightGauge))
				require.Equal(t, float64(1), testutil.ToFloat64(metrics.requestsCounter))
				require.Equal(t, float64(0), testutil.ToFloat64(metrics.failureCounter))
			},
		},
		{
			name: "failure",
			handler: func(writer http.ResponseWriter, request *http.Request) {
				writer.WriteHeader(http.StatusInternalServerError)
			},
			assert: func(t *testing.T, metrics *PrometheusMetrics) {
				require.Equal(t, float64(0), testutil.ToFloat64(metrics.inFlightGauge))
				require.Equal(t, float64(1), testutil.ToFloat64(metrics.requestsCounter))
				require.Equal(t, float64(1), testutil.ToFloat64(metrics.failureCounter))
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			// Create metrics and make sure they are 0
			metrics := NewPrometheusMetricsMiddleware("test")
			require.Equal(t, float64(0), testutil.ToFloat64(metrics.inFlightGauge))
			require.Equal(t, float64(0), testutil.ToFloat64(metrics.requestsCounter))
			require.Equal(t, float64(0), testutil.ToFloat64(metrics.failureCounter))

			// Set up test server
			// Default to noOpHandlerFunc if it's not provided in test case
			h := tc.handler
			if h == nil {
				h = noOpHandlerFunc
			}
			srv := httptest.NewServer(h)
			t.Cleanup(srv.Close)

			// Make request with the prometheus handling middleware
			cl, err := httpclient.New(httpclient.Options{
				Middlewares: []httpclient.Middleware{PrometheusMetricsMiddleware(metrics)},
			})
			require.NoError(t, err)

			resp, err := cl.Get(srv.URL)
			defer func() { _ = resp.Body.Close() }()
			require.NoError(t, err)
			require.NotNil(t, resp)

			// Run test-case-specific assertions
			tc.assert(t, metrics)
		})
	}

	t.Run("in flight", func(t *testing.T) {
		metrics := NewPrometheusMetricsMiddleware("test")
		require.Equal(t, float64(0), testutil.ToFloat64(metrics.inFlightGauge))

		srv := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			// Assert in-flight requests
			require.Equal(t, float64(1), testutil.ToFloat64(metrics.inFlightGauge), "in flight should increase during request")
		}))
		t.Cleanup(srv.Close)

		cl, err := httpclient.New(httpclient.Options{
			Middlewares: []httpclient.Middleware{PrometheusMetricsMiddleware(metrics)},
		})
		require.NoError(t, err)

		resp, err := cl.Get(srv.URL)
		defer func() { _ = resp.Body.Close() }()
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, float64(0), testutil.ToFloat64(metrics.inFlightGauge), "in flight should decrease after response")
	})
}

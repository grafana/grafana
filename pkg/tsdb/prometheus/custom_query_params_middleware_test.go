package prometheus

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"
)

func TestCustomQueryParametersMiddleware(t *testing.T) {
	require.Equal(t, "customQueryParameters", customQueryParametersKey)

	finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK}, nil
	})

	t.Run("Without custom query parameters set should not apply middleware", func(t *testing.T) {
		mw := customQueryParametersMiddleware()
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, customQueryParametersMiddlewareName, middlewareName.MiddlewareName())

		req, err := http.NewRequest(http.MethodGet, "http://test.com/query?hello=name", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}

		require.Equal(t, "http://test.com/query?hello=name", req.URL.String())
	})

	t.Run("Without custom query parameters set as string should not apply middleware", func(t *testing.T) {
		mw := customQueryParametersMiddleware()
		rt := mw.CreateMiddleware(httpclient.Options{
			CustomOptions: map[string]interface{}{
				customQueryParametersKey: 64,
			},
		}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, customQueryParametersMiddlewareName, middlewareName.MiddlewareName())

		req, err := http.NewRequest(http.MethodGet, "http://test.com/query?hello=name", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}

		require.Equal(t, "http://test.com/query?hello=name", req.URL.String())
	})

	t.Run("With custom query parameters set as empty string should not apply middleware", func(t *testing.T) {
		mw := customQueryParametersMiddleware()
		rt := mw.CreateMiddleware(httpclient.Options{
			CustomOptions: map[string]interface{}{
				customQueryParametersKey: "",
			},
		}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, customQueryParametersMiddlewareName, middlewareName.MiddlewareName())

		req, err := http.NewRequest(http.MethodGet, "http://test.com/query?hello=name", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}

		require.Equal(t, "http://test.com/query?hello=name", req.URL.String())
	})

	t.Run("With custom query parameters set as string should apply middleware", func(t *testing.T) {
		mw := customQueryParametersMiddleware()
		rt := mw.CreateMiddleware(httpclient.Options{
			CustomOptions: map[string]interface{}{
				customQueryParametersKey: "custom=par/am&second=f oo",
			},
		}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, customQueryParametersMiddlewareName, middlewareName.MiddlewareName())

		req, err := http.NewRequest(http.MethodGet, "http://test.com/query?hello=name", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}

		require.Equal(t, "http://test.com/query?hello=name&custom=par%2Fam&second=f+oo", req.URL.String())
	})
}

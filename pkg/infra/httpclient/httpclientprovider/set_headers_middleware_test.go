package httpclientprovider

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"
)

func TestSetHeadersMiddleware(t *testing.T) {
	t.Run("Without headers set should return next http.RoundTripper", func(t *testing.T) {
		ctx := &testContext{}
		finalRoundTripper := ctx.createRoundTripper("finalrt")
		var headers http.Header
		mw := SetHeadersMiddleware(headers)
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, SetHeadersMiddlewareName, middlewareName.MiddlewareName())

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
	})

	t.Run("With headers set should apply HTTP headers to the request", func(t *testing.T) {
		ctx := &testContext{}
		finalRoundTripper := ctx.createRoundTripper("final")
		headers := http.Header{
			"X-Header-A": []string{"value a"},
			"X-Header-B": []string{"value b"},
			"X-HEader-C": []string{"value c"},
		}
		mw := SetHeadersMiddleware(headers)
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, SetHeadersMiddlewareName, middlewareName.MiddlewareName())

		req, err := http.NewRequest(http.MethodGet, "http://", nil)
		require.NoError(t, err)
		req.Header.Set("X-Header-B", "d")
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}
		require.Len(t, ctx.callChain, 1)
		require.ElementsMatch(t, []string{"final"}, ctx.callChain)

		require.Equal(t, "value a", req.Header.Get("X-Header-A"))
		require.Equal(t, "value b", req.Header.Get("X-Header-B"))
		require.Equal(t, "value c", req.Header.Get("X-Header-C"))
	})
}

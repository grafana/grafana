package httpclientprovider

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"
)

func TestDeleteHeadersMiddleware(t *testing.T) {
	t.Run("Without headerNames should return next http.RoundTripper", func(t *testing.T) {
		ctx := &testContext{}
		finalRoundTripper := ctx.createRoundTripper("finalrt")
		var headerNames []string
		mw := DeleteHeadersMiddleware(headerNames...)
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, DeleteHeadersMiddlewareName, middlewareName.MiddlewareName())

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
		headerNames := []string{"X-Header-B", "X-Header-C"}
		mw := DeleteHeadersMiddleware(headerNames...)
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, DeleteHeadersMiddlewareName, middlewareName.MiddlewareName())

		req, err := http.NewRequest(http.MethodGet, "http://", nil)
		require.NoError(t, err)
		req.Header.Set("X-Header-A", "a")
		req.Header.Set("X-Header-B", "b")
		req.Header.Set("X-Header-C", "c")
		req.Header.Set("X-Header-D", "d")
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}
		require.Len(t, ctx.callChain, 1)
		require.ElementsMatch(t, []string{"final"}, ctx.callChain)

		require.Equal(t, "a", req.Header.Get("X-Header-A"))
		require.Empty(t, req.Header.Get("X-Header-B"))
		require.Empty(t, req.Header.Get("X-Header-C"))
		require.Equal(t, "d", req.Header.Get("X-Header-D"))
	})
}

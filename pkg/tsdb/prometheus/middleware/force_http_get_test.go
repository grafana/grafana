package middleware

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
)

func TestEnsureHttpMethodMiddleware(t *testing.T) {
	t.Run("Name should be correct", func(t *testing.T) {
		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK}, nil
		})
		mw := ForceHttpGet(log.New("test"))
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, "force-http-get", middlewareName.MiddlewareName())
	})

	t.Run("Should force GET method", func(t *testing.T) {
		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK}, nil
		})

		mw := ForceHttpGet(log.New("test"))
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)

		req, err := http.NewRequest(http.MethodPost, "http://example.com", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		require.Equal(t, res.StatusCode, http.StatusMethodNotAllowed)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}
	})
}

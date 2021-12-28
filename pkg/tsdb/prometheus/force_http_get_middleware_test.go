package prometheus

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
)

func TestForceGet(t *testing.T) {
	t.Run("With nil jsonOpts, should not force get-method", func(t *testing.T) {
		var jsonOpts map[string]interface{}
		require.False(t, forceHttpGet(jsonOpts))
	})

	t.Run("With empty jsonOpts, should not force get-method", func(t *testing.T) {
		jsonOpts := make(map[string]interface{})
		require.False(t, forceHttpGet(jsonOpts))
	})

	t.Run("With httpMethod=nil, should not not force get-method", func(t *testing.T) {
		jsonOpts := map[string]interface{}{
			"httpMethod": nil,
		}
		require.False(t, forceHttpGet(jsonOpts))
	})

	t.Run("With httpMethod=post, should not force get-method", func(t *testing.T) {
		jsonOpts := map[string]interface{}{
			"httpMethod": "POST",
		}
		require.False(t, forceHttpGet(jsonOpts))
	})

	t.Run("With httpMethod=get, should force get-method", func(t *testing.T) {
		jsonOpts := map[string]interface{}{
			"httpMethod": "get",
		}
		require.True(t, forceHttpGet(jsonOpts))
	})

	t.Run("With httpMethod=GET, should force get-method", func(t *testing.T) {
		jsonOpts := map[string]interface{}{
			"httpMethod": "GET",
		}
		require.True(t, forceHttpGet(jsonOpts))
	})
}

func TestEnsureHttpMethodMiddleware(t *testing.T) {
	t.Run("Name should be correct", func(t *testing.T) {
		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK}, nil
		})
		mw := forceHttpGetMiddleware(log.New("test"))
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

		mw := forceHttpGetMiddleware(log.New("test"))
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

package prometheus

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
)

// we run a POST request, and verify that the response-code is what we want.
func requirePostResponseStatusCode(t *testing.T, options httpclient.Options, statusCode int) {
	finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK}, nil
	})

	mw := ensureHttpMethodMiddleware(log.New("test"))
	rt := mw.CreateMiddleware(options, finalRoundTripper)
	require.NotNil(t, rt)

	req, err := http.NewRequest(http.MethodPost, "http://example.com", nil)
	require.NoError(t, err)
	res, err := rt.RoundTrip(req)
	require.NoError(t, err)
	require.NotNil(t, res)
	require.Equal(t, res.StatusCode, statusCode)
	if res.Body != nil {
		require.NoError(t, res.Body.Close())
	}
}

func TestEnsureHttpMethodMiddleware(t *testing.T) {
	finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK}, nil
	})

	t.Run("Name should be correct", func(t *testing.T) {
		mw := ensureHttpMethodMiddleware(log.New("test"))
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, "prom-ensure-http-method", middlewareName.MiddlewareName())
	})

	t.Run("Without custom options, should not apply middleware", func(t *testing.T) {
		requirePostResponseStatusCode(t, httpclient.Options{}, http.StatusOK)
	})

	t.Run("With empty custom options, should not apply middleware", func(t *testing.T) {
		requirePostResponseStatusCode(t, httpclient.Options{
			CustomOptions: map[string]interface{}{},
		}, http.StatusOK)
	})

	t.Run("With empty grafana data in custom options, should not apply middleware", func(t *testing.T) {
		requirePostResponseStatusCode(t, httpclient.Options{
			CustomOptions: map[string]interface{}{
				"grafanaData": map[string]interface{}{},
			},
		}, http.StatusOK)
	})

	t.Run("With httpMethod=nil, should not apply middleware", func(t *testing.T) {
		requirePostResponseStatusCode(t, httpclient.Options{
			CustomOptions: map[string]interface{}{
				"grafanaData": map[string]interface{}{
					"httpMethod": nil,
				},
			},
		}, http.StatusOK)
	})

	t.Run("With httpMethod=post, should not apply middleware", func(t *testing.T) {
		requirePostResponseStatusCode(t, httpclient.Options{
			CustomOptions: map[string]interface{}{
				"grafanaData": map[string]interface{}{
					"httpMethod": "post",
				},
			},
		}, http.StatusOK)
	})

	t.Run("With httpMethod=get, should apply middleware", func(t *testing.T) {
		requirePostResponseStatusCode(t, httpclient.Options{
			CustomOptions: map[string]interface{}{
				"grafanaData": map[string]interface{}{
					"httpMethod": "get",
				},
			},
		}, http.StatusMethodNotAllowed)
	})

	t.Run("With httpMethod=GET, should apply middleware", func(t *testing.T) {
		requirePostResponseStatusCode(t, httpclient.Options{
			CustomOptions: map[string]interface{}{
				"grafanaData": map[string]interface{}{
					"httpMethod": "GET",
				},
			},
		}, http.StatusMethodNotAllowed)
	})
}

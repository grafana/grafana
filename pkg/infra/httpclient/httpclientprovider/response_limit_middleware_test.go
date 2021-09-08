package httpclientprovider

import (
	"context"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"
	"io/ioutil"
	"net/http"
	"strings"
	"testing"
)

func TestResponseLimitMiddleware(t *testing.T) {
	t.Run("Test ResponseLimitMiddleware with set limit", func(t *testing.T) {

		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK, Request: req, Body: ioutil.NopCloser(strings.NewReader("dummy"))}, nil
		})

		mw := ResponseLimitMiddleware(1)
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, ResponseLimitMiddlewareName, middlewareName.MiddlewareName())

		ctx := context.Background()
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://test.com/query", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}

		bodyBytes, err := ioutil.ReadAll(res.Body)
		require.EqualError(t, err, "http: request body too large")

		require.Len(t, bodyBytes, 1)
		require.Equal(t, string(bodyBytes), "d")
	})

	t.Run("Test ResponseLimitMiddleware without limit", func(t *testing.T) {

		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK, Request: req, Body: ioutil.NopCloser(strings.NewReader("dummy"))}, nil
		})

		mw := ResponseLimitMiddleware(1000000)
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, ResponseLimitMiddlewareName, middlewareName.MiddlewareName())

		ctx := context.Background()
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://test.com/query", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}

		bodyBytes, err := ioutil.ReadAll(res.Body)
		require.NoError(t, err)

		require.Len(t, bodyBytes, 5)
		require.Equal(t, string(bodyBytes), "dummy")
	})
}

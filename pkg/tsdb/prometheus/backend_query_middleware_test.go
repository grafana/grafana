package prometheus

import (
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
)

func TestBackendQueryMiddleware(t *testing.T) {
	finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK}, nil
	})

	t.Run("Headers in the request context should be added to the request", func(t *testing.T) {
		mw := backendQueryMiddleware(log.New("test"))
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, backendQueryMiddlewareName, middlewareName.MiddlewareName())

		ctx := context.WithValue(context.Background(), backendQueryHeadersKey, map[string]string{
			"X-Grafana-Test":  "test",
			"X-Grafana-Test2": "test2",
		})
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://test.com/query", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}

		require.Equal(t, req.Header.Get("X-Grafana-Test"), "test")
		require.Equal(t, req.Header.Get("X-Grafana-Test2"), "test2")
	})

	t.Run("If nil or empty headers are given, the request should not be modified", func(t *testing.T) {
		mw := backendQueryMiddleware(log.New("test"))
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, backendQueryMiddlewareName, middlewareName.MiddlewareName())

		// Header present, but nil
		{
			ctx := context.WithValue(context.Background(), backendQueryHeadersKey, nil)
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://test.com/query", nil)
			headers := req.Header.Clone()
			require.NoError(t, err)
			res, err := rt.RoundTrip(req)
			require.NoError(t, err)
			require.NotNil(t, res)
			if res.Body != nil {
				require.NoError(t, res.Body.Close())
			}

			require.Equal(t, req.Header, headers)
		}

		// Header present, but empty
		{
			ctx := context.WithValue(context.Background(), backendQueryHeadersKey, map[string]string{})
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://test.com/query", nil)
			headers := req.Header.Clone()
			require.NoError(t, err)
			res, err := rt.RoundTrip(req)
			require.NoError(t, err)
			require.NotNil(t, res)
			if res.Body != nil {
				require.NoError(t, res.Body.Close())
			}

			require.Equal(t, req.Header, headers)
		}

		// Header not present
		{
			ctx := context.Background()
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://test.com/query", nil)
			headers := req.Header.Clone()
			require.NoError(t, err)
			res, err := rt.RoundTrip(req)
			require.NoError(t, err)
			require.NotNil(t, res)
			if res.Body != nil {
				require.NoError(t, res.Body.Close())
			}

			require.Equal(t, req.Header, headers)
		}
	})
}

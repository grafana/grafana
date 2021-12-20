package prometheus

import (
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
)

func TestCustomQueryParametersMiddleware(t *testing.T) {
	require.Equal(t, "customQueryParameters", customQueryParametersKey)

	finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK}, nil
	})

	t.Run("Name should be correct", func(t *testing.T) {
		mw := customQueryParametersMiddleware(log.New("test"), "custom=%%abc&test=abc")
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, customQueryParametersMiddlewareName, middlewareName.MiddlewareName())
	})

	t.Run("With custom query parameters set as invalid query string should not apply middleware", func(t *testing.T) {
		mw := customQueryParametersMiddleware(log.New("test"), "custom=%%abc&test=abc")
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)

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

	t.Run("With custom query parameters set should apply middleware for request URL containing query parameters ", func(t *testing.T) {
		mw := customQueryParametersMiddleware(log.New("test"), "custom=par/am&second=f oo")
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)

		req, err := http.NewRequest(http.MethodGet, "http://test.com/query?hello=name", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}

		require.True(t, strings.HasPrefix(req.URL.String(), "http://test.com/query?"))

		q := req.URL.Query()
		require.Len(t, q, 3)
		require.Equal(t, "name", url.QueryEscape(q.Get("hello")))
		require.Equal(t, "par%2Fam", url.QueryEscape(q.Get("custom")))
		require.Equal(t, "f+oo", url.QueryEscape(q.Get("second")))
	})

	t.Run("With custom query parameters set should apply middleware for request URL not containing query parameters", func(t *testing.T) {
		mw := customQueryParametersMiddleware(log.New("test"), "custom=par/am&second=f oo")
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)

		req, err := http.NewRequest(http.MethodGet, "http://test.com/query", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}

		require.Equal(t, "http://test.com/query?custom=par%2Fam&second=f+oo", req.URL.String())
	})
}

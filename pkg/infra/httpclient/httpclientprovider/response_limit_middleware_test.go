package httpclientprovider

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"
)

func TestResponseLimitMiddleware(t *testing.T) {
	tcs := []struct {
		limit      int64
		bodyLength int
		body       string
		err        error
	}{
		{limit: 1, bodyLength: 1, body: "d", err: errors.New("error: http: response body too large, response limit is set to: 1")},
		{limit: 1000000, bodyLength: 5, body: "dummy", err: nil},
		{limit: 0, bodyLength: 5, body: "dummy", err: nil},
	}
	for _, tc := range tcs {
		t.Run(fmt.Sprintf("Test ResponseLimitMiddleware with limit: %d", tc.limit), func(t *testing.T) {
			finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
				return &http.Response{StatusCode: http.StatusOK, Request: req, Body: io.NopCloser(strings.NewReader("dummy"))}, nil
			})

			mw := ResponseLimitMiddleware(tc.limit)
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
			require.NotNil(t, res.Body)
			require.NoError(t, res.Body.Close())

			bodyBytes, err := io.ReadAll(res.Body)
			if err != nil {
				require.EqualError(t, tc.err, err.Error())
			} else {
				require.NoError(t, tc.err)
			}

			require.Len(t, bodyBytes, tc.bodyLength)
			require.Equal(t, string(bodyBytes), tc.body)
		})
	}
}

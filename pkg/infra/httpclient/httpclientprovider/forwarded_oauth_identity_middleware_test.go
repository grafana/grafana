package httpclientprovider_test

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/stretchr/testify/require"
)

func TestForwardedOAuthIdentityMiddleware(t *testing.T) {
	tcs := []struct {
		desc                        string
		headers                     map[string]string
		expectedAuthorizationHeader string
		expectedIDTokenHeader       string
	}{
		{
			desc:                        "With nil headers should not populate Cookie headers",
			headers:                     nil,
			expectedAuthorizationHeader: "",
			expectedIDTokenHeader:       "",
		},
		{
			desc:                        "With empty headers should not populate headers",
			headers:                     map[string]string{},
			expectedAuthorizationHeader: "",
			expectedIDTokenHeader:       "",
		},
		{
			desc:                        "With Authorization header set should populate Authorization header",
			headers:                     map[string]string{"Authorization": "bearer something"},
			expectedAuthorizationHeader: "bearer something",
			expectedIDTokenHeader:       "",
		},
		{
			desc:                        "With X-ID-Token header set should populate X-ID-Token header",
			headers:                     map[string]string{"X-ID-Token": "token payload"},
			expectedAuthorizationHeader: "",
			expectedIDTokenHeader:       "token payload",
		},
		{
			desc: "With Authorization and X-ID-Token header set should populate Authorization and X-Id-Token header",
			headers: map[string]string{
				"Authorization": "bearer something",
				"X-ID-Token":    "token payload",
			},
			expectedAuthorizationHeader: "bearer something",
			expectedIDTokenHeader:       "token payload",
		},
	}

	for _, tc := range tcs {
		t.Run(tc.desc, func(t *testing.T) {
			ctx := &testContext{}
			finalRoundTripper := ctx.createRoundTripper()
			mw := httpclientprovider.ForwardedOAuthIdentityMiddleware(tc.headers)
			opts := httpclient.Options{}
			rt := mw.CreateMiddleware(opts, finalRoundTripper)
			require.NotNil(t, rt)
			middlewareName, ok := mw.(httpclient.MiddlewareName)
			require.True(t, ok)
			require.Equal(t, "forwarded-oauth-identity", middlewareName.MiddlewareName())

			req, err := http.NewRequest(http.MethodGet, "http://", nil)
			require.NoError(t, err)
			res, err := rt.RoundTrip(req)
			require.NoError(t, err)
			require.NotNil(t, res)
			if res.Body != nil {
				require.NoError(t, res.Body.Close())
			}
			require.Len(t, ctx.callChain, 1)
			require.ElementsMatch(t, []string{"final"}, ctx.callChain)
			require.Equal(t, tc.expectedAuthorizationHeader, ctx.req.Header.Get("Authorization"))
			require.Equal(t, tc.expectedIDTokenHeader, ctx.req.Header.Get("X-ID-Token"))
		})
	}
}

type testContext struct {
	callChain []string
	req       *http.Request
}

func (c *testContext) createRoundTripper() http.RoundTripper {
	return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		c.callChain = append(c.callChain, "final")
		c.req = req
		return &http.Response{StatusCode: http.StatusOK}, nil
	})
}

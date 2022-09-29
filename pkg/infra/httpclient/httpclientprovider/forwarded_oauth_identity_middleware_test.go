package httpclientprovider_test

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
)

func TestForwardedOAuthIdentityMiddleware(t *testing.T) {
	at := &oauth2.Token{
		AccessToken: "access-token",
	}
	tcs := []struct {
		desc                        string
		token                       *oauth2.Token
		expectedAuthorizationHeader string
		expectedIDTokenHeader       string
	}{
		{
			desc:                        "With nil token should not populate Cookie headers",
			token:                       nil,
			expectedAuthorizationHeader: "",
			expectedIDTokenHeader:       "",
		},
		{
			desc:                        "With access token set should populate Authorization header",
			token:                       at,
			expectedAuthorizationHeader: "Bearer access-token",
			expectedIDTokenHeader:       "",
		},
		{
			desc:                        "With Authorization and X-ID-Token header set should populate Authorization and X-Id-Token header",
			token:                       at.WithExtra(map[string]interface{}{"id_token": "id-token"}),
			expectedAuthorizationHeader: "Bearer access-token",
			expectedIDTokenHeader:       "id-token",
		},
	}

	for _, tc := range tcs {
		t.Run(tc.desc, func(t *testing.T) {
			ctx := &testContext{}
			finalRoundTripper := ctx.createRoundTripper()
			mw := httpclientprovider.ForwardedOAuthIdentityMiddleware(tc.token)
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

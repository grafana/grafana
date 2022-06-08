package httpclientprovider_test

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/stretchr/testify/require"
)

func TestForwardedCookiesMiddleware(t *testing.T) {
	tcs := []struct {
		desc                 string
		allowedCookies       []string
		expectedCookieHeader string
	}{
		{
			desc:                 "With nil allowedCookies should not populate Cookie header",
			allowedCookies:       nil,
			expectedCookieHeader: "",
		},
		{
			desc:                 "With empty allowed cookies should not populate Cookie header",
			allowedCookies:       []string{},
			expectedCookieHeader: "",
		},
		{
			desc:                 "When provided with allowed cookies should populate Cookie header",
			allowedCookies:       []string{"c1", "c3"},
			expectedCookieHeader: "c1=1; c3=3",
		},
	}

	for _, tc := range tcs {
		t.Run(tc.desc, func(t *testing.T) {
			ctx := &testContext{}
			finalRoundTripper := ctx.createRoundTripper()
			mw := httpclientprovider.ForwardedCookiesMiddleware(tc.allowedCookies)
			opts := httpclient.Options{}
			rt := mw.CreateMiddleware(opts, finalRoundTripper)
			require.NotNil(t, rt)
			middlewareName, ok := mw.(httpclient.MiddlewareName)
			require.True(t, ok)
			require.Equal(t, "forwarded-cookies", middlewareName.MiddlewareName())

			req, err := http.NewRequest(http.MethodGet, "http://", nil)
			require.NoError(t, err)
			req.AddCookie(&http.Cookie{Name: "c1", Value: "1"})
			req.AddCookie(&http.Cookie{Name: "c2", Value: "2"})
			req.AddCookie(&http.Cookie{Name: "c3", Value: "3"})
			res, err := rt.RoundTrip(req)
			require.NoError(t, err)
			require.NotNil(t, res)
			if res.Body != nil {
				require.NoError(t, res.Body.Close())
			}
			require.Len(t, ctx.callChain, 1)
			require.ElementsMatch(t, []string{"final"}, ctx.callChain)
			require.Equal(t, tc.expectedCookieHeader, ctx.req.Header.Get("Cookie"))
		})
	}
}

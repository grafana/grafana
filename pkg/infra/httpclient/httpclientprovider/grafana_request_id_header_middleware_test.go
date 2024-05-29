package httpclientprovider

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/url"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/clientmiddleware"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestGrafanaRequestIDHeaderMiddleware(t *testing.T) {
	testCases := []struct {
		description                   string
		allowedURLs                   []*url.URL
		requestURL                    string
		remoteAddress                 string
		expectGrafanaRequestIDHeaders bool
		expectPrivateRequestHeader    bool
	}{
		{
			description: "With target URL in the allowed URL list and remote address specified, should add headers to the request but the request should not be marked as private",
			allowedURLs: []*url.URL{{
				Scheme: "https",
				Host:   "grafana.com",
			}},
			requestURL:                    "https://grafana.com/api/some/path",
			remoteAddress:                 "1.2.3.4",
			expectGrafanaRequestIDHeaders: true,
			expectPrivateRequestHeader:    false,
		},
		{
			description: "With target URL in the allowed URL list and remote address not specified, should add headers to the request and the request should be marked as private",
			allowedURLs: []*url.URL{{
				Scheme: "https",
				Host:   "grafana.com",
			}},
			requestURL:                    "https://grafana.com/api/some/path",
			expectGrafanaRequestIDHeaders: true,
			expectPrivateRequestHeader:    true,
		},
		{
			description: "With target URL not in the allowed URL list, should not add headers to the request",
			allowedURLs: []*url.URL{{
				Scheme: "https",
				Host:   "grafana.com",
			}},
			requestURL:                    "https://fake-grafana.com/api/some/path",
			expectGrafanaRequestIDHeaders: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.description, func(t *testing.T) {
			ctx := &testContext{}
			finalRoundTripper := ctx.createRoundTripper("final")
			cfg := setting.NewCfg()
			cfg.IPRangeACEnabled = false
			cfg.IPRangeACAllowedURLs = tc.allowedURLs
			cfg.IPRangeACSecretKey = "secret"
			mw := GrafanaRequestIDHeaderMiddleware(cfg, log.New("test"))
			rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
			require.NotNil(t, rt)
			middlewareName, ok := mw.(httpclient.MiddlewareName)
			require.True(t, ok)
			require.Equal(t, GrafanaRequestIDHeaderMiddlewareName, middlewareName.MiddlewareName())

			req, err := http.NewRequest(http.MethodGet, tc.requestURL, nil)
			require.NoError(t, err)
			req.RemoteAddr = tc.remoteAddress
			res, err := rt.RoundTrip(req)
			require.NoError(t, err)
			require.NotNil(t, res)
			if res.Body != nil {
				require.NoError(t, res.Body.Close())
			}
			require.Len(t, ctx.callChain, 1)
			require.ElementsMatch(t, []string{"final"}, ctx.callChain)

			if !tc.expectGrafanaRequestIDHeaders {
				require.Len(t, req.Header.Values(clientmiddleware.GrafanaRequestID), 0)
				require.Len(t, req.Header.Values(clientmiddleware.GrafanaSignedRequestID), 0)
			} else {
				require.Len(t, req.Header.Values(clientmiddleware.GrafanaRequestID), 1)
				require.Len(t, req.Header.Values(clientmiddleware.GrafanaSignedRequestID), 1)
				requestID := req.Header.Get(clientmiddleware.GrafanaRequestID)

				instance := hmac.New(sha256.New, []byte(cfg.IPRangeACSecretKey))
				_, err = instance.Write([]byte(requestID))
				require.NoError(t, err)
				computed := hex.EncodeToString(instance.Sum(nil))

				require.Equal(t, req.Header.Get(clientmiddleware.GrafanaSignedRequestID), computed)

				if tc.remoteAddress == "" {
					require.Equal(t, req.Header.Get(clientmiddleware.GrafanaInternalRequest), "true")
				} else {
					require.Len(t, req.Header.Values(clientmiddleware.XRealIPHeader), 1)
					require.Equal(t, req.Header.Get(clientmiddleware.XRealIPHeader), tc.remoteAddress)

					// Internal header should not be set
					require.Len(t, req.Header.Values(clientmiddleware.GrafanaInternalRequest), 0)
				}
			}
		})
	}
}

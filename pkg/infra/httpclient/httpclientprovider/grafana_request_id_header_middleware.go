package httpclientprovider

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"path"

	"github.com/google/uuid"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/clientmiddleware"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

const GrafanaRequestIDHeaderMiddlewareName = "grafana-request-id-header-middleware"

func GrafanaRequestIDHeaderMiddleware(cfg *setting.Cfg) sdkhttpclient.Middleware {
	return sdkhttpclient.NamedMiddlewareFunc(GrafanaRequestIDHeaderMiddlewareName, func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		return sdkhttpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			// Check if the request is for a datasource that is allowed to have the header
			// TODO check if this is the path to the datasource
			target := req.URL.Path

			foundMatch := false
			for _, allowedURL := range cfg.IPRangeACAllowedURLs {
				if path.Clean(allowedURL) == path.Clean(target) {
					foundMatch = true
					break
				}
			}
			if !foundMatch {
				return next.RoundTrip(req)
			}

			// Generate a new Grafana request ID and sign it with the secret key
			uid, err := uuid.NewRandom()
			if err != nil {
				return next.RoundTrip(req)
			}
			grafanaRequestID := uid.String()

			hmac := hmac.New(sha256.New, []byte(cfg.IPRangeACSecretKey))
			if _, err := hmac.Write([]byte(grafanaRequestID)); err != nil {
				return next.RoundTrip(req)
			}
			signedGrafanaRequestID := hex.EncodeToString(hmac.Sum(nil))
			req.Header.Set(clientmiddleware.GrafanaSignedRequestID, signedGrafanaRequestID)
			req.Header.Set(clientmiddleware.GrafanaRequestID, grafanaRequestID)

			remoteAddress := web.RemoteAddr(req)
			if remoteAddress == "" {
				req.Header.Set(clientmiddleware.GrafanaInternalRequest, grafanaRequestID)
			}

			return next.RoundTrip(req)
		})
	})
}

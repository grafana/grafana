package httpclientprovider

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"

	"github.com/google/uuid"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/clientmiddleware"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

const GrafanaRequestIDHeaderMiddlewareName = "grafana-request-id-header-middleware"

func GrafanaRequestIDHeaderMiddleware(cfg *setting.Cfg, logger log.Logger) sdkhttpclient.Middleware {
	return sdkhttpclient.NamedMiddlewareFunc(GrafanaRequestIDHeaderMiddlewareName, func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		return sdkhttpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			foundMatch := false
			for _, allowedURL := range cfg.IPRangeACAllowedURLs {
				// Only look at the scheme and host, ignore the path
				if allowedURL.Host == req.URL.Host && allowedURL.Scheme == req.URL.Scheme {
					foundMatch = true
					break
				}
			}
			if !foundMatch {
				logger.Debug("Data source URL not among the allow-listed URLs", "url", req.URL.String())
				return next.RoundTrip(req)
			}

			// Generate a new Grafana request ID and sign it with the secret key
			uid, err := uuid.NewRandom()
			if err != nil {
				logger.Debug("Failed to generate Grafana request ID", "error", err)
				return next.RoundTrip(req)
			}
			grafanaRequestID := uid.String()

			hmac := hmac.New(sha256.New, []byte(cfg.IPRangeACSecretKey))
			if _, err := hmac.Write([]byte(grafanaRequestID)); err != nil {
				logger.Debug("Failed to sign IP range access control header", "error", err)
				return next.RoundTrip(req)
			}
			signedGrafanaRequestID := hex.EncodeToString(hmac.Sum(nil))
			req.Header.Set(clientmiddleware.GrafanaSignedRequestID, signedGrafanaRequestID)
			req.Header.Set(clientmiddleware.GrafanaRequestID, grafanaRequestID)

			remoteAddress := web.RemoteAddr(req)
			if remoteAddress != "" {
				req.Header.Set(clientmiddleware.XRealIPHeader, remoteAddress)
			} else {
				req.Header.Set(clientmiddleware.GrafanaInternalRequest, "true")
			}

			return next.RoundTrip(req)
		})
	})
}

package httpclientprovider

import (
	"net/http"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/clientmiddleware"
	"github.com/grafana/grafana/pkg/setting"
)

const GrafanaRequestIDHeaderMiddlewareName = "grafana-request-id-header-middleware"

func GrafanaRequestIDHeaderMiddleware(cfg *setting.Cfg, logger log.Logger) sdkhttpclient.Middleware {
	return sdkhttpclient.NamedMiddlewareFunc(GrafanaRequestIDHeaderMiddlewareName, func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		return sdkhttpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			if req.Header.Get(clientmiddleware.GrafanaRequestID) != "" {
				logger.Debug("Request already has a Grafana request ID header", "request_id", req.Header.Get(clientmiddleware.GrafanaRequestID))
				return next.RoundTrip(req)
			}

			if !clientmiddleware.IsRequestURLInAllowList(req.URL, cfg) {
				logger.Debug("Data source URL not among the allow-listed URLs", "url", req.URL.String())
				return next.RoundTrip(req)
			}

			for k, v := range clientmiddleware.GetGrafanaRequestIDHeaders(req, cfg, logger) {
				req.Header.Set(k, v)
			}

			return next.RoundTrip(req)
		})
	})
}

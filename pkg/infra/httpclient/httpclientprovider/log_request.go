package httpclientprovider

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
)

func LogRequestMiddleware(logger log.Logger) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc("log-request", func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			logger.Info("============ outgoing request", "URL", req.URL)
			return next.RoundTrip(req)
		})
	})
}

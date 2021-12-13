package prometheus

import (
	"net/http"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	backendQueryMiddlewareName = "prom-backend-query"
)

type backendQueryHeaders struct{}

var backendQueryHeadersKey = &backendQueryHeaders{}

func backendQueryMiddleware(logger log.Logger) sdkhttpclient.Middleware {
	return sdkhttpclient.NamedMiddlewareFunc(backendQueryMiddlewareName, func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		return sdkhttpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			ctx := req.Context()
			// Apply custom headers if set
			if headers := ctx.Value(backendQueryHeadersKey); headers != nil {
				if m, ok := headers.(map[string]string); ok {
					for k, v := range m {
						req.Header.Add(k, v)
					}
				}
			}
			return next.RoundTrip(req)
		})
	})
}

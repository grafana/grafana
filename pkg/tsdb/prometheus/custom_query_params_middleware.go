package prometheus

import (
	"net/http"
	"net/url"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	customQueryParametersMiddlewareName = "prom-custom-query-parameters"
	customQueryParametersKey            = "customQueryParameters"
	grafanaDataKey                      = "grafanaData"
)

func customQueryParametersMiddleware(logger log.Logger, customQueryParams string) sdkhttpclient.Middleware {
	return sdkhttpclient.NamedMiddlewareFunc(customQueryParametersMiddlewareName, func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {

		values, err := url.ParseQuery(customQueryParams)
		if err != nil {
			logger.Error("Failed to parse custom query parameters, skipping middleware", "error", err)
			return next
		}

		return sdkhttpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			q := req.URL.Query()
			for k, keyValues := range values {
				for _, value := range keyValues {
					q.Add(k, value)
				}
			}
			req.URL.RawQuery = q.Encode()

			return next.RoundTrip(req)
		})
	})
}

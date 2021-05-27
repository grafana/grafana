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
)

func customQueryParametersMiddleware(logger log.Logger) sdkhttpclient.Middleware {
	return sdkhttpclient.NamedMiddlewareFunc(customQueryParametersMiddlewareName, func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		customQueryParamsVal, exists := opts.CustomOptions[customQueryParametersKey]
		if !exists {
			return next
		}
		customQueryParams, ok := customQueryParamsVal.(string)
		if !ok || customQueryParams == "" {
			return next
		}

		values, err := url.ParseQuery(customQueryParams)
		if err != nil {
			log.Error("Failed to parse custom query parameters, skipping middleware", "error", err)
			return next
		}

		return sdkhttpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			if len(values) > 0 {
				if len(req.URL.RawQuery) > 0 {
					req.URL.RawQuery += "&"
				}
				req.URL.RawQuery += values.Encode()
			}

			return next.RoundTrip(req)
		})
	})
}

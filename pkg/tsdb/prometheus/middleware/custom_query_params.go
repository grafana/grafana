package middleware

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

func CustomQueryParameters(logger log.Logger) sdkhttpclient.Middleware {
	return sdkhttpclient.NamedMiddlewareFunc(customQueryParametersMiddlewareName, func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		grafanaData, exists := opts.CustomOptions[grafanaDataKey]
		if !exists {
			return next
		}

		data, ok := grafanaData.(map[string]interface{})
		if !ok {
			return next
		}
		customQueryParamsVal, exists := data[customQueryParametersKey]
		if !exists {
			return next
		}

		customQueryParams, ok := customQueryParamsVal.(string)
		if !ok || customQueryParams == "" {
			return next
		}

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

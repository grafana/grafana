package prometheus

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

const (
	customQueryParametersMiddlewareName = "prom-custom-query-parameters"
	customQueryParametersKey            = "customQueryParameters"
)

func customQueryParametersMiddleware() sdkhttpclient.Middleware {
	return sdkhttpclient.NamedMiddlewareFunc(customQueryParametersMiddlewareName, func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		customQueryParamsVal, exists := opts.CustomOptions[customQueryParametersKey]
		if !exists {
			return next
		}
		customQueryParams, ok := customQueryParamsVal.(string)
		if !ok || customQueryParams == "" {
			return next
		}

		return sdkhttpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			params := url.Values{}
			for _, param := range strings.Split(customQueryParams, "&") {
				parts := strings.Split(param, "=")
				if len(parts) == 1 {
					// This is probably a mistake on the users part in defining the params but we don't want to crash.
					params.Add(parts[0], "")
				} else {
					params.Add(parts[0], parts[1])
				}
			}
			if req.URL.RawQuery != "" {
				req.URL.RawQuery = fmt.Sprintf("%s&%s", req.URL.RawQuery, params.Encode())
			} else {
				req.URL.RawQuery = params.Encode()
			}

			return next.RoundTrip(req)
		})
	})
}

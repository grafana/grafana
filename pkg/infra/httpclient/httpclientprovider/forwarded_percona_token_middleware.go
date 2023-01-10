package httpclientprovider

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

const ForwardedProxyFilterMiddlewareName = "forwarded-x-proxy-filter"

func ForwardedProxyFilterMiddleware(token string) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc(ForwardedProxyFilterMiddlewareName, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		if token == "" {
			return next
		}
		return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			req.Header.Set("X-Proxy-Filter", token)

			return next.RoundTrip(req)
		})
	})
}

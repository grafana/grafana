package httpclientprovider

import (
	"net/http"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

const ForwardedProxyFilterMiddlewareName = "forwarded-x-proxy-filter"

func ForwardedProxyFilterMiddleware(token string) sdkhttpclient.Middleware {
	return sdkhttpclient.NamedMiddlewareFunc(ForwardedProxyFilterMiddlewareName, func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		if token == "" {
			return next
		}
		return sdkhttpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			req.Header.Set("X-Proxy-Filter", token)

			return next.RoundTrip(req)
		})
	})
}

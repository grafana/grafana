package middleware

import (
	"net/http"

	sdkHTTPClient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

// ReqHeadersMiddleware is used so that we can pass req headers through the prometheus go client as it does not allow
// access to the request directly. Should be used together with WithContextualMiddleware so that it is attached to
// the context of each request with its unique headers.
func ReqHeadersMiddleware(headers map[string]string) sdkHTTPClient.Middleware {
	return sdkHTTPClient.NamedMiddlewareFunc("prometheus-req-headers-middleware", func(opts sdkHTTPClient.Options, next http.RoundTripper) http.RoundTripper {
		return sdkHTTPClient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			for k, v := range headers {
				// As custom headers middleware is before contextual we may overwrite custom headers here with those
				// that came with the request which probably makes sense.
				req.Header[k] = []string{v}
			}

			return next.RoundTrip(req)
		})
	})
}

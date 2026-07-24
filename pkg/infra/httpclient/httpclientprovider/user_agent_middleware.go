package httpclientprovider

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

// SetUserAgentMiddlewareName is the middleware name used by SetUserAgentMiddleware.
const SetUserAgentMiddlewareName = "user-agent"

// SetUserAgentMiddleware is middleware that sets the HTTP header User-Agent on the outgoing request.
// If User-Agent already set, it will not be overridden by this middleware.
func SetUserAgentMiddleware(userAgent string) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc(SetUserAgentMiddlewareName, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		if userAgent == "" {
			return next
		}

		return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			if req.Header.Get("User-Agent") == "" {
				req.Header.Set("User-Agent", userAgent)
			}
			return next.RoundTrip(req)
		})
	})
}

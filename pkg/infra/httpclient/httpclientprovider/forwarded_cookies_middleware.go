package httpclientprovider

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

// ForwardedCookiesMiddleware middleware that sets Cookie header on the
// outgoing request, if forwarded cookies configured/provided.
func ForwardedCookiesMiddleware(allowedCookies []string) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc("forwarded-cookies", func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			proxyutil.ClearCookieHeader(req, allowedCookies)
			return next.RoundTrip(req)
		})
	})
}

package httpclientprovider

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

const ForwardedCookiesMiddlewareName = "forwarded-cookies"

// ForwardedCookiesMiddleware middleware that sets Cookie header on the
// outgoing request, if forwarded cookies configured/provided.
func ForwardedCookiesMiddleware(forwardedCookies []*http.Cookie, allowedCookies []string, disallowedCookies []string) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc(ForwardedCookiesMiddlewareName, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			for _, cookie := range forwardedCookies {
				req.AddCookie(cookie)
			}
			proxyutil.ClearCookieHeader(req, allowedCookies, disallowedCookies)
			return next.RoundTrip(req)
		})
	})
}

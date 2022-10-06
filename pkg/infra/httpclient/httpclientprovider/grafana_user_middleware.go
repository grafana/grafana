package httpclientprovider

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

// SetGrafanaUserMiddlewareName is the middleware name associated with SetGrafanaUserMiddleware.
const SetGrafanaUserMiddlewareName = "grafana-user"

// SetGrafanaUserMiddlewareName is middleware that sets the HTTP header X-Grafana-User on the outgoing request.
// If Grafana-User already set, it will not be overridden by this middleware.
func SetGrafanaUserMiddleware(login string) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc(SetGrafanaUserMiddlewareName, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		if login == "" {
			return next
		}

		return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			if req.Header.Get("X-Grafana-User") == "" {
				req.Header.Set("X-Grafana-User", login)
			}
			return next.RoundTrip(req)
		})
	})
}

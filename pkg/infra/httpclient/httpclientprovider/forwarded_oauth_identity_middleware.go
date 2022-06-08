package httpclientprovider

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

// ForwardedOAuthIdentityMiddleware middleware that sets Authorization/X-ID-Token
// headers on the outgoing request, if forwarded OAuth identity configured/provided.
func ForwardedOAuthIdentityMiddleware(headers map[string]string) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc("forwarded-oauth-identity", func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		authzHeader, authzHeaderExists := headers["Authorization"]
		idTokenHeader, idTokenHeaderExists := headers["X-ID-Token"]

		if !authzHeaderExists && !idTokenHeaderExists {
			return next
		}

		return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			if authzHeaderExists {
				req.Header.Set("Authorization", authzHeader)
			}

			if idTokenHeaderExists {
				req.Header.Set("X-ID-Token", idTokenHeader)
			}

			return next.RoundTrip(req)
		})
	})
}

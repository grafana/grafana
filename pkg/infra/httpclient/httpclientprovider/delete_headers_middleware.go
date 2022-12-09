package httpclientprovider

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

const DeleteHeadersMiddlewareName = "delete-headers"

// DeleteHeadersMiddleware middleware that delete headers on the outgoing
// request if header names provided.
func DeleteHeadersMiddleware(headerNames ...string) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc(DeleteHeadersMiddlewareName, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		if len(headerNames) == 0 {
			return next
		}

		return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			for _, k := range headerNames {
				req.Header.Del(k)
			}

			return next.RoundTrip(req)
		})
	})
}

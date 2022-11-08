package httpclientprovider

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

const SetHeadersMiddlewareName = "forwarded-headers"

// SetHeadersMiddleware middleware that sets headers on the outgoing
// request if headers provided.
// If the request already contains any of the headers provided, they
// will be overwritten.
func SetHeadersMiddleware(headers http.Header) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc(SetHeadersMiddlewareName, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		if headers == nil {
			return next
		}

		return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			for k, v := range headers {
				req.Header[k] = v
			}

			return next.RoundTrip(req)
		})
	})
}

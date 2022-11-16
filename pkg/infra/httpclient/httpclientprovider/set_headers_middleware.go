package httpclientprovider

import (
	"net/http"
	"net/textproto"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

const SetHeadersMiddlewareName = "set-headers"

// SetHeadersMiddleware middleware that sets headers on the outgoing
// request if headers provided.
// If the request already contains any of the headers provided, they
// will be overwritten.
func SetHeadersMiddleware(headers http.Header) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc(SetHeadersMiddlewareName, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		if len(headers) == 0 {
			return next
		}

		return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			for k, v := range headers {
				canonicalKey := textproto.CanonicalMIMEHeaderKey(k)
				req.Header[canonicalKey] = v
			}

			return next.RoundTrip(req)
		})
	})
}

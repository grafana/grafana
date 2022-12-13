package httpclientprovider

import (
	"net/http"
	"net/textproto"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

const (
	SetHeadersMiddlewareName = "set-headers"
	idTokenHeaderName        = "X-ID-Token"
)

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
				key := textproto.CanonicalMIMEHeaderKey(k)
				if key == textproto.CanonicalMIMEHeaderKey(idTokenHeaderName) {
					// Edge case: Before introducing middlewares, we wrongly used X-ID-Token
					// (which is not canonical) rather than X-Id-Token, so use the old non-canonical
					// header name for backwards compatibility, for now.
					key = idTokenHeaderName
				}
				req.Header[key] = v
			}

			return next.RoundTrip(req)
		})
	})
}

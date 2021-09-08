package httpclientprovider

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"net/http"
)

// ResponseLimitMiddlewareName is the middleware name used by ResponseLimitMiddleware.
const ResponseLimitMiddlewareName = "response-limit"

func ResponseLimitMiddleware(limit int64) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc(ResponseLimitMiddlewareName, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			res, err := next.RoundTrip(req)
			if err != nil {
				return nil, err
			}

			res.Body = http.MaxBytesReader(nil, res.Body, limit)
			return res, nil
		})
	})
}

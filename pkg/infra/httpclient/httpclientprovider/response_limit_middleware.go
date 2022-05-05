package httpclientprovider

import (
	"net/http"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient"
)

// ResponseLimitMiddlewareName is the middleware name used by ResponseLimitMiddleware.
const ResponseLimitMiddlewareName = "response-limit"

func ResponseLimitMiddleware(limit int64) sdkhttpclient.Middleware {
	return sdkhttpclient.NamedMiddlewareFunc(ResponseLimitMiddlewareName, func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		if limit <= 0 {
			return next
		}
		return sdkhttpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			res, err := next.RoundTrip(req)
			if err != nil {
				return nil, err
			}

			if res != nil && res.StatusCode != http.StatusSwitchingProtocols {
				res.Body = httpclient.MaxBytesReader(res.Body, limit)
			}

			return res, nil
		})
	})
}

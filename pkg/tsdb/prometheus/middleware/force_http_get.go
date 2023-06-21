package middleware

import (
	"net/http"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/infra/log"
)

func ForceHttpGet(logger log.Logger) sdkhttpclient.Middleware {
	return sdkhttpclient.NamedMiddlewareFunc("force-http-get", func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		// the prometheus library we use does not allow us to set the http method.
		// it's behavior is to first try POST, and if it fails in certain ways
		// (for example, by returning a method-not-allowed error), it will try GET.
		// so here, we check if the http-method is POST, and if it is, we
		// return an artificial method-not-allowed response.
		// this will cause the prometheus library to retry with GET.
		return sdkhttpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			if req.Method == http.MethodPost {
				resp := &http.Response{
					StatusCode: http.StatusMethodNotAllowed,
				}
				return resp, nil
			}

			return next.RoundTrip(req)
		})
	})
}

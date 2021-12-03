package prometheus

import (
	"net/http"
	"strings"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
)

func ensureHttpMethodMiddleware(logger log.Logger) sdkhttpclient.Middleware {
	return sdkhttpclient.NamedMiddlewareFunc("prom-ensure-http-method", func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		// this middleware only does something if the httpMethod setting is set to GET
		grafanaData, exists := opts.CustomOptions["grafanaData"]
		if !exists {
			return next
		}

		data, ok := grafanaData.(map[string]interface{})
		if !ok {
			return next
		}

		methodInterface, exists := data["httpMethod"]
		if !exists {
			return next
		}

		method, ok := methodInterface.(string)
		if !ok {
			return next
		}

		if strings.ToLower(method) != "get" {
			return next
		}

		// at this point we know the user selected GET as http-method.

		// the prometheus library we use does not allow us to set the http method.
		// it's behavior is to first try POST, and if it fails in certain ways
		// (for example, by returning a method-not-allowed error), it will try GET.
		// so here, we check if the http-method is POST, and if it is, we
		// return an artificial method-not-allowed response.
		// this will cause the prometheus library to retry with GET.
		return sdkhttpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			if true {
				if req.Method == http.MethodPost {
					resp := &http.Response{
						StatusCode: http.StatusMethodNotAllowed,
					}
					return resp, nil
				}
			}

			return next.RoundTrip(req)
		})
	})
}

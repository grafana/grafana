package httpclientprovider

import (
	"net/http"

	"github.com/grafana/grafana/pkg/models"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

const HostRedirectValidationMiddlewareName = "host-redirect-validation"

func RedirectLimitMiddleware(reqValidator models.PluginRequestValidator) sdkhttpclient.Middleware {
	return sdkhttpclient.NamedMiddlewareFunc(HostRedirectValidationMiddlewareName, func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		return sdkhttpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			res, err := next.RoundTrip(req)
			if err != nil {
				return nil, err
			}
			if res.StatusCode >= 300 && res.StatusCode < 400 {
				location, err := res.Location()
				if err != nil {
					return nil, err
				}

				if err := reqValidator.Validate(location.String(), nil); err != nil {
					return nil, err
				}
			}
			return res, err
		})
	})
}

package tokenprovider

import (
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

var (
	// timeNow makes it possible to test usage of time
	timeNow = time.Now
)

type TokenProvider interface {
	GetAccessToken() (string, error)
}

const authenticationMiddlewareName = "AzureAuthentication"

func AuthMiddleware(tokenProvider TokenProvider) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc(authenticationMiddlewareName, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			token, err := tokenProvider.GetAccessToken()
			if err != nil {
				return nil, fmt.Errorf("failed to retrieve azure access token: %w", err)
			}
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
			return next.RoundTrip(req)
		})
	})
}

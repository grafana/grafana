package deprecated

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

func GetAppInsightsMiddleware(url, appInsightsApiKey string) httpclient.Middleware {
	if appInsightsApiKey != "" && url == AzAppInsights.URL || url == AzChinaAppInsights.URL {
		// Inject API-Key for AppInsights
		return httpclient.MiddlewareFunc(func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
			return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
				req.Header.Set("X-API-Key", appInsightsApiKey)
				return next.RoundTrip(req)
			})
		})
	}
	return nil
}

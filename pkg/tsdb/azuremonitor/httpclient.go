package azuremonitor

import (
	"net/http"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient"
)

func getMiddlewares(route azRoute, model datasourceInfo) ([]sdkhttpclient.Middleware, error) {
	var middlewares []sdkhttpclient.Middleware

	if _, ok := model.DecryptedSecureJSONData["appInsightsApiKey"]; ok && (route.URL == azAppInsights.URL || route.URL == azChinaAppInsights.URL) {
		// Inject API-Key for AppInsights
		apiKeyMiddleware := sdkhttpclient.MiddlewareFunc(func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
			return sdkhttpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
				req.Header.Set("X-API-Key", model.DecryptedSecureJSONData["appInsightsApiKey"])
				return next.RoundTrip(req)
			})
		})
		middlewares = append(middlewares, apiKeyMiddleware)
	}

	return middlewares, nil
}

func newHTTPClient(route azRoute, model datasourceInfo, clientProvider httpclient.Provider) (*http.Client, error) {
	m, err := getMiddlewares(route, model)
	if err != nil {
		return nil, err
	}

	opts := sdkhttpclient.Options{
		Headers:     route.Headers,
		Middlewares: m,
	}

	// Use Azure credentials if the route has OAuth scopes configured
	if len(route.Scopes) > 0 {
		opts.CustomOptions = map[string]interface{}{
			"_azureCredentials": model.Credentials,
			"_azureScopes":      route.Scopes,
		}
	}

	return clientProvider.New(opts)
}

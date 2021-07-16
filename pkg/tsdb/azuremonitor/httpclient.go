package azuremonitor

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/aztokenprovider"
)

func getMiddlewares(route azRoute, model datasourceInfo, cfg *setting.Cfg) ([]httpclient.Middleware, error) {
	middlewares := []httpclient.Middleware{}

	if len(route.Scopes) > 0 {
		tokenProvider, err := aztokenprovider.NewAzureAccessTokenProvider(cfg, model.Credentials)
		if err != nil {
			return nil, err
		}
		middlewares = append(middlewares, aztokenprovider.AuthMiddleware(tokenProvider, route.Scopes))
	}

	if _, ok := model.DecryptedSecureJSONData["appInsightsApiKey"]; ok && (route.URL == azAppInsights.URL || route.URL == azChinaAppInsights.URL) {
		// Inject API-Key for AppInsights
		apiKeyMiddleware := httpclient.MiddlewareFunc(func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
			return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
				req.Header.Set("X-API-Key", model.DecryptedSecureJSONData["appInsightsApiKey"])
				return next.RoundTrip(req)
			})
		})
		middlewares = append(middlewares, apiKeyMiddleware)
	}

	return middlewares, nil
}

func newHTTPClient(route azRoute, model datasourceInfo, cfg *setting.Cfg, clientProvider httpclient.Provider) (*http.Client, error) {
	m, err := getMiddlewares(route, model, cfg)
	if err != nil {
		return nil, err
	}

	return clientProvider.New(httpclient.Options{
		Headers:     route.Headers,
		Middlewares: m,
	})
}

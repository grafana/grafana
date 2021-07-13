package azuremonitor

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/aztokenprovider"
)

func httpClientProvider(route azRoute, model datasourceInfo, cfg *setting.Cfg) (*httpclient.Provider, error) {
	middlewares := []httpclient.Middleware{}

	if len(route.Scopes) > 0 {
		tokenProvider, err := aztokenprovider.NewAzureAccessTokenProvider(cfg, model.Credentials)
		if err != nil {
			return nil, err
		}
		middlewares = append(middlewares, aztokenprovider.AuthMiddleware(tokenProvider, route.Scopes))
	}

	if _, ok := model.DecryptedSecureJSONData["appInsightsApiKey"]; ok {
		// Inject API-Key for AppInsights
		apiKeyMiddleware := httpclient.MiddlewareFunc(func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
			return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
				req.Header.Set("X-API-Key", model.DecryptedSecureJSONData["appInsightsApiKey"])
				return next.RoundTrip(req)
			})
		})
		middlewares = append(middlewares, apiKeyMiddleware)
	}

	return httpclient.NewProvider(httpclient.ProviderOptions{
		Middlewares: middlewares,
	}), nil
}

func newHTTPClient(route azRoute, model datasourceInfo, cfg *setting.Cfg) (*http.Client, error) {
	model.HTTPCliOpts.Headers = route.Headers
	clientProvider, err := httpClientProvider(route, model, cfg)
	if err != nil {
		return nil, err
	}

	return clientProvider.New(model.HTTPCliOpts)
}

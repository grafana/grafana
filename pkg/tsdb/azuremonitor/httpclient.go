package azuremonitor

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/aztokenprovider"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/deprecated"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

func getMiddlewares(route types.AzRoute, model types.DatasourceInfo, cfg *setting.Cfg) ([]httpclient.Middleware, error) {
	middlewares := []httpclient.Middleware{}

	if len(route.Scopes) > 0 {
		tokenProvider, err := aztokenprovider.NewAzureAccessTokenProvider(cfg, model.Credentials)
		if err != nil {
			return nil, err
		}
		middlewares = append(middlewares, aztokenprovider.AuthMiddleware(tokenProvider, route.Scopes))
	}

	// Remove with Grafana 9
	if apiKeyMiddleware := deprecated.GetAppInsightsMiddleware(route.URL, model.DecryptedSecureJSONData["appInsightsApiKey"]); apiKeyMiddleware != nil {
		middlewares = append(middlewares, apiKeyMiddleware)
	}

	return middlewares, nil
}

func newHTTPClient(route types.AzRoute, model types.DatasourceInfo, cfg *setting.Cfg, clientProvider httpclient.Provider) (*http.Client, error) {
	m, err := getMiddlewares(route, model, cfg)
	if err != nil {
		return nil, err
	}

	return clientProvider.New(httpclient.Options{
		Headers:     route.Headers,
		Middlewares: m,
	})
}

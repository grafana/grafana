package azuremonitor

import (
	"net/http"

	"github.com/grafana/grafana-azure-sdk-go/azhttpclient"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/deprecated"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

func getMiddlewares(route types.AzRoute, model types.DatasourceInfo) ([]sdkhttpclient.Middleware, error) {
	var middlewares []sdkhttpclient.Middleware

	// Remove with Grafana 9
	if apiKeyMiddleware := deprecated.GetAppInsightsMiddleware(route.URL, model.DecryptedSecureJSONData["appInsightsApiKey"]); apiKeyMiddleware != nil {
		middlewares = append(middlewares, apiKeyMiddleware)
	}

	return middlewares, nil
}

func newHTTPClient(route types.AzRoute, model types.DatasourceInfo, cfg *setting.Cfg, clientProvider httpclient.Provider) (*http.Client, error) {
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
		azhttpclient.AddAzureAuthentication(&opts, cfg.Azure, model.Credentials, route.Scopes)
	}

	return clientProvider.New(opts)
}

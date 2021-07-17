package prometheus

import (
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/aztokenprovider"
	"github.com/prometheus/client_golang/api"
)

func newAPIClient(provider httpclient.Provider, dsInfo *models.DataSource, cfg *setting.Cfg) (api.Client, error) {
	var middlewares []sdkhttpclient.Middleware

	// Azure authentication
	if azureCredentials, err := getAzureCredentials(cfg, dsInfo.JsonData, dsInfo.DecryptedValues()); err != nil {
		return nil, err
	} else if azureCredentials != nil {
		tokenProvider, err := aztokenprovider.NewAzureAccessTokenProvider(cfg, azureCredentials)
		if err != nil {
			return nil, err
		}
		scopes, err := getAzureEndpointScopes(dsInfo.JsonData)
		if err != nil {
			return nil, err
		}

		middlewares = append(middlewares, aztokenprovider.AuthMiddleware(tokenProvider, scopes))
	}

	middlewares = append(middlewares, customQueryParametersMiddleware(plog))

	transport, err := dsInfo.GetHTTPTransport(provider, middlewares...)
	if err != nil {
		return nil, err
	}

	apiConfig := api.Config{
		Address:      dsInfo.Url,
		RoundTripper: transport,
	}

	return api.NewClient(apiConfig)
}

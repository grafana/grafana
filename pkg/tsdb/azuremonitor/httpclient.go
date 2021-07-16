package azuremonitor

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/aztokenprovider"
)

func httpClientProvider(route azRoute, model datasourceInfo, cfg *setting.Cfg) (*httpclient.Provider, error) {
	var clientProvider *httpclient.Provider

	if len(route.Scopes) > 0 {
		tokenProvider, err := aztokenprovider.NewAzureAccessTokenProvider(cfg, model.Credentials)
		if err != nil {
			return nil, err
		}

		clientProvider = httpclient.NewProvider(httpclient.ProviderOptions{
			Middlewares: []httpclient.Middleware{
				aztokenprovider.AuthMiddleware(tokenProvider, route.Scopes),
			},
		})
	} else {
		clientProvider = httpclient.NewProvider()
	}

	return clientProvider, nil
}

func newHTTPClient(route azRoute, model datasourceInfo, cfg *setting.Cfg) (*http.Client, error) {
	model.HTTPCliOpts.Headers = route.Headers

	clientProvider, err := httpClientProvider(route, model, cfg)
	if err != nil {
		return nil, err
	}

	return clientProvider.New(model.HTTPCliOpts)
}

package pluginproxy

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
)

type azureAccessTokenProvider struct {
	datasourceId             int64
	datasourceVersion        int
	route                    *plugins.AppPluginRoute
	authParams               *plugins.JwtTokenAuth
	appIdentityTokenProvider accessTokenProvider
}

func newAzureAccessTokenProvider(ds *models.DataSource, pluginRoute *plugins.AppPluginRoute,
	authParams *plugins.JwtTokenAuth) *azureAccessTokenProvider {
	appIdentityTokenProvider := newGenericAccessTokenProvider(ds, pluginRoute, authParams)
	return &azureAccessTokenProvider{
		datasourceId:             ds.Id,
		datasourceVersion:        ds.Version,
		route:                    pluginRoute,
		authParams:               authParams,
		appIdentityTokenProvider: appIdentityTokenProvider,
	}
}

func (provider *azureAccessTokenProvider) getAccessToken() (string, error) {
	return provider.appIdentityTokenProvider.getAccessToken()
}

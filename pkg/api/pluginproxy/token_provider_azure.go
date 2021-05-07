package pluginproxy

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

type azureAccessTokenProvider struct {
	datasourceId             int64
	datasourceVersion        int
	ctx                      context.Context
	cfg                      *setting.Cfg
	route                    *plugins.AppPluginRoute
	authParams               *plugins.JwtTokenAuth
	appIdentityTokenProvider accessTokenProvider
}

func newAzureAccessTokenProvider(ctx context.Context, cfg *setting.Cfg, ds *models.DataSource,
	pluginRoute *plugins.AppPluginRoute, authParams *plugins.JwtTokenAuth) *azureAccessTokenProvider {
	appIdentityTokenProvider := newGenericAccessTokenProvider(ds, pluginRoute, authParams)
	return &azureAccessTokenProvider{
		datasourceId:             ds.Id,
		datasourceVersion:        ds.Version,
		ctx:                      ctx,
		cfg:                      cfg,
		route:                    pluginRoute,
		authParams:               authParams,
		appIdentityTokenProvider: appIdentityTokenProvider,
	}
}

func (provider *azureAccessTokenProvider) getAccessToken() (string, error) {
	return provider.appIdentityTokenProvider.getAccessToken()
}

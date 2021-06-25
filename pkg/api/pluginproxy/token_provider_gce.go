package pluginproxy

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"golang.org/x/oauth2/google"
)

type gceAccessTokenProvider struct {
	datasourceId      int64
	datasourceVersion int
	ctx               context.Context
	route             *plugins.AppPluginRoute
	authParams        *plugins.JwtTokenAuth
}

func newGceAccessTokenProvider(ctx context.Context, ds *models.DataSource, pluginRoute *plugins.AppPluginRoute,
	authParams *plugins.JwtTokenAuth) *gceAccessTokenProvider {
	return &gceAccessTokenProvider{
		datasourceId:      ds.Id,
		datasourceVersion: ds.Version,
		ctx:               ctx,
		route:             pluginRoute,
		authParams:        authParams,
	}
}

func (provider *gceAccessTokenProvider) GetAccessToken() (string, error) {
	tokenSrc, err := google.DefaultTokenSource(provider.ctx, provider.authParams.Scopes...)
	if err != nil {
		logger.Error("Failed to get default token from meta data server", "error", err)
		return "", err
	} else {
		token, err := tokenSrc.Token()
		if err != nil {
			logger.Error("Failed to get default access token from meta data server", "error", err)
			return "", err
		} else {
			return token.AccessToken, nil
		}
	}
}

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
}

func newGceAccessTokenProvider(ctx context.Context, ds *models.DataSource, pluginRoute *plugins.AppPluginRoute) *gceAccessTokenProvider {
	return &gceAccessTokenProvider{
		datasourceId:      ds.Id,
		datasourceVersion: ds.Version,
		ctx:               ctx,
		route:             pluginRoute,
	}
}

func (provider *gceAccessTokenProvider) getAccessToken() (string, error) {
	tokenSrc, err := google.DefaultTokenSource(provider.ctx, provider.route.JwtTokenAuth.Scopes...)
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

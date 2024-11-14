package pluginproxy

import (
	"context"

	googletokenprovider "github.com/grafana/grafana-google-sdk-go/pkg/tokenprovider"
	"github.com/grafana/grafana/pkg/plugins"
)

type gceAccessTokenProvider struct {
	source googletokenprovider.TokenProvider
	ctx    context.Context
}

func newGceAccessTokenProvider(ctx context.Context, ds DSInfo, pluginRoute *plugins.Route,
	authParams *plugins.JWTTokenAuth) *gceAccessTokenProvider {
	cfg := googletokenprovider.Config{
		RoutePath:         pluginRoute.Path,
		RouteMethod:       pluginRoute.Method,
		DataSourceID:      ds.ID,
		DataSourceUpdated: ds.Updated,
		Scopes:            authParams.Scopes,
	}
	return &gceAccessTokenProvider{
		source: googletokenprovider.NewGceAccessTokenProvider(cfg),
		ctx:    ctx,
	}
}

func (provider *gceAccessTokenProvider) GetAccessToken() (string, error) {
	return provider.source.GetAccessToken(provider.ctx)
}

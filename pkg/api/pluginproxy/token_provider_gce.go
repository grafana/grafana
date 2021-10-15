package pluginproxy

import (
	"context"

	googletokenprovider "github.com/grafana/grafana-google-sdk-go/tokenprovider"
	"github.com/grafana/grafana/pkg/plugins"
)

func newGceAccessTokenProvider(ctx context.Context, ds DSInfo, pluginRoute *plugins.AppPluginRoute,
	authParams *plugins.JwtTokenAuth) (googletokenprovider.TokenProvider, error) {
	cfg := googletokenprovider.Config{
		RoutePath:         pluginRoute.Path,
		RouteMethod:       pluginRoute.Method,
		DataSourceID:      ds.ID,
		DataSourceUpdated: ds.Updated,
		Scopes:            authParams.Scopes,
	}
	return googletokenprovider.NewGceAccessTokenProvider(ctx, &cfg)
}

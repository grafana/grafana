package pluginproxy

import (
	"context"

	googletokenprovider "github.com/grafana/grafana-google-sdk-go/tokenprovider"
	"github.com/grafana/grafana/pkg/plugins"
)

type gceAccessTokenProvider struct {
	tokenProvider googletokenprovider.TokenProvider
	initErr       error
}

func newGceAccessTokenProvider(ctx context.Context, ds DSInfo, pluginRoute *plugins.AppPluginRoute,
	authParams *plugins.JwtTokenAuth) *gceAccessTokenProvider {
	cfg := googletokenprovider.Config{
		RoutePath:         pluginRoute.Path,
		RouteMethod:       pluginRoute.Method,
		DataSourceID:      ds.ID,
		DataSourceUpdated: ds.Updated,
		Scopes:            authParams.Scopes,
	}
	gceProvider := &gceAccessTokenProvider{}
	gceProvider.tokenProvider, gceProvider.initErr = googletokenprovider.NewGceAccessTokenProvider(ctx, &cfg)
	return gceProvider
}

func (provider *gceAccessTokenProvider) GetAccessToken() (string, error) {
	return provider.tokenProvider.GetAccessToken()
}

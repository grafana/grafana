package pluginproxy

import (
	"context"

	googletokenprovider "github.com/grafana/grafana-google-sdk-go/tokenprovider"
	"github.com/grafana/grafana/pkg/plugins"
)

type jwtAccessTokenProvider struct {
	tokenProvider googletokenprovider.TokenProvider
}

func newJwtAccessTokenProvider(ctx context.Context, ds DSInfo, pluginRoute *plugins.AppPluginRoute,
	authParams *plugins.JwtTokenAuth) *jwtAccessTokenProvider {
	jwtConf := &googletokenprovider.JwtTokenConfig{}
	if val, ok := authParams.Params["client_email"]; ok {
		jwtConf.Email = val
	}

	if val, ok := authParams.Params["private_key"]; ok {
		jwtConf.PrivateKey = []byte(val)
	}

	if val, ok := authParams.Params["token_uri"]; ok {
		jwtConf.URI = val
	}

	cfg := &googletokenprovider.Config{
		RoutePath:         pluginRoute.Path,
		RouteMethod:       pluginRoute.Method,
		DataSourceID:      ds.ID,
		DataSourceUpdated: ds.Updated,
		Scopes:            authParams.Scopes,
		JwtTokenConfig:    jwtConf,
	}

	return &jwtAccessTokenProvider{
		tokenProvider: googletokenprovider.NewJwtAccessTokenProvider(ctx, cfg),
	}
}

func (provider *jwtAccessTokenProvider) GetAccessToken() (string, error) {
	return provider.tokenProvider.GetAccessToken()
}

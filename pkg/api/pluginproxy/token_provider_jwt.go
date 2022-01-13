package pluginproxy

import (
	"context"

	googletokenprovider "github.com/grafana/grafana-google-sdk-go/pkg/tokenprovider"
	"github.com/grafana/grafana/pkg/plugins"
)

type jwtAccessTokenProvider struct {
	source googletokenprovider.TokenProvider
	ctx    context.Context
}

func newJwtAccessTokenProvider(ctx context.Context, ds DSInfo, pluginRoute *plugins.Route,
	authParams *plugins.JWTTokenAuth) *jwtAccessTokenProvider {
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

	cfg := googletokenprovider.Config{
		RoutePath:         pluginRoute.Path,
		RouteMethod:       pluginRoute.Method,
		DataSourceID:      ds.ID,
		DataSourceUpdated: ds.Updated,
		Scopes:            authParams.Scopes,
		JwtTokenConfig:    jwtConf,
	}

	return &jwtAccessTokenProvider{
		source: googletokenprovider.NewJwtAccessTokenProvider(cfg),
		ctx:    ctx,
	}
}

func (provider *jwtAccessTokenProvider) GetAccessToken() (string, error) {
	return provider.source.GetAccessToken(provider.ctx)
}

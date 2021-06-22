package pluginproxy

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/jwt"
)

var (
	oauthJwtTokenCache = oauthJwtTokenCacheType{
		cache: map[string]*oauth2.Token{},
	}
)

type oauthJwtTokenCacheType struct {
	cache map[string]*oauth2.Token
	sync.Mutex
}

type jwtAccessTokenProvider struct {
	datasourceId      int64
	datasourceVersion int
	ctx               context.Context
	route             *plugins.AppPluginRoute
	authParams        *plugins.JwtTokenAuth
}

func newJwtAccessTokenProvider(ctx context.Context, ds *models.DataSource, pluginRoute *plugins.AppPluginRoute,
	authParams *plugins.JwtTokenAuth) *jwtAccessTokenProvider {
	return &jwtAccessTokenProvider{
		datasourceId:      ds.Id,
		datasourceVersion: ds.Version,
		ctx:               ctx,
		route:             pluginRoute,
		authParams:        authParams,
	}
}

func (provider *jwtAccessTokenProvider) GetAccessToken() (string, error) {
	oauthJwtTokenCache.Lock()
	defer oauthJwtTokenCache.Unlock()
	if cachedToken, found := oauthJwtTokenCache.cache[provider.getAccessTokenCacheKey()]; found {
		if cachedToken.Expiry.After(timeNow().Add(time.Second * 10)) {
			logger.Debug("Using token from cache")
			return cachedToken.AccessToken, nil
		}
	}

	conf := &jwt.Config{}

	if val, ok := provider.authParams.Params["client_email"]; ok {
		conf.Email = val
	}

	if val, ok := provider.authParams.Params["private_key"]; ok {
		conf.PrivateKey = []byte(val)
	}

	if val, ok := provider.authParams.Params["token_uri"]; ok {
		conf.TokenURL = val
	}

	conf.Scopes = provider.authParams.Scopes

	token, err := getTokenSource(conf, provider.ctx)
	if err != nil {
		return "", err
	}

	oauthJwtTokenCache.cache[provider.getAccessTokenCacheKey()] = token

	logger.Info("Got new access token", "ExpiresOn", token.Expiry)

	return token.AccessToken, nil
}

// getTokenSource gets a token source.
// Stubbable by tests.
var getTokenSource = func(conf *jwt.Config, ctx context.Context) (*oauth2.Token, error) {
	tokenSrc := conf.TokenSource(ctx)
	token, err := tokenSrc.Token()
	if err != nil {
		return nil, err
	}

	return token, nil
}

func (provider *jwtAccessTokenProvider) getAccessTokenCacheKey() string {
	return fmt.Sprintf("%v_%v_%v_%v", provider.datasourceId, provider.datasourceVersion, provider.route.Path, provider.route.Method)
}

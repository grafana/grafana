package pluginproxy

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"golang.org/x/oauth2/jwt"
)

var (
	tokenCache = tokenCacheType{
		cache: map[string]*jwtToken{},
	}
	oauthJwtTokenCache = oauthJwtTokenCacheType{
		cache: map[string]*oauth2.Token{},
	}
)

type tokenCacheType struct {
	cache map[string]*jwtToken
	sync.Mutex
}

type oauthJwtTokenCacheType struct {
	cache map[string]*oauth2.Token
	sync.Mutex
}

type accessTokenProvider struct {
	route             *plugins.AppPluginRoute
	datasourceId      int64
	datasourceVersion int
}

type jwtToken struct {
	ExpiresOn       time.Time `json:"-"`
	ExpiresOnString string    `json:"expires_on"`
	AccessToken     string    `json:"access_token"`
}

func newAccessTokenProvider(ds *models.DataSource, pluginRoute *plugins.AppPluginRoute) *accessTokenProvider {
	return &accessTokenProvider{
		datasourceId:      ds.Id,
		datasourceVersion: ds.Version,
		route:             pluginRoute,
	}
}

func (provider *accessTokenProvider) getAccessToken(data templateData) (string, error) {
	tokenCache.Lock()
	defer tokenCache.Unlock()
	if cachedToken, found := tokenCache.cache[provider.getAccessTokenCacheKey()]; found {
		if cachedToken.ExpiresOn.After(time.Now().Add(time.Second * 10)) {
			logger.Info("Using token from cache")
			return cachedToken.AccessToken, nil
		}
	}

	urlInterpolated, err := interpolateString(provider.route.TokenAuth.Url, data)
	if err != nil {
		return "", err
	}

	params := make(url.Values)
	for key, value := range provider.route.TokenAuth.Params {
		interpolatedParam, err := interpolateString(value, data)
		if err != nil {
			return "", err
		}
		params.Add(key, interpolatedParam)
	}

	getTokenReq, _ := http.NewRequest("POST", urlInterpolated, bytes.NewBufferString(params.Encode()))
	getTokenReq.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	getTokenReq.Header.Add("Content-Length", strconv.Itoa(len(params.Encode())))

	resp, err := client.Do(getTokenReq)
	if err != nil {
		return "", err
	}

	defer resp.Body.Close()

	var token jwtToken
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return "", err
	}

	expiresOnEpoch, _ := strconv.ParseInt(token.ExpiresOnString, 10, 64)
	token.ExpiresOn = time.Unix(expiresOnEpoch, 0)
	tokenCache.cache[provider.getAccessTokenCacheKey()] = &token

	logger.Info("Got new access token", "ExpiresOn", token.ExpiresOn)

	return token.AccessToken, nil
}

func (provider *accessTokenProvider) getJwtAccessToken(ctx context.Context, data templateData) (string, error) {
	oauthJwtTokenCache.Lock()
	defer oauthJwtTokenCache.Unlock()
	if cachedToken, found := oauthJwtTokenCache.cache[provider.getAccessTokenCacheKey()]; found {
		if cachedToken.Expiry.After(time.Now().Add(time.Second * 10)) {
			logger.Debug("Using token from cache")
			return cachedToken.AccessToken, nil
		}
	}

	conf := &jwt.Config{}

	if val, ok := provider.route.JwtTokenAuth.Params["client_email"]; ok {
		interpolatedVal, err := interpolateString(val, data)
		if err != nil {
			return "", err
		}
		conf.Email = interpolatedVal
	}

	if val, ok := provider.route.JwtTokenAuth.Params["private_key"]; ok {
		interpolatedVal, err := interpolateString(val, data)
		if err != nil {
			return "", err
		}
		conf.PrivateKey = []byte(interpolatedVal)
	}

	if val, ok := provider.route.JwtTokenAuth.Params["token_uri"]; ok {
		interpolatedVal, err := interpolateString(val, data)
		if err != nil {
			return "", err
		}
		conf.TokenURL = interpolatedVal
	}

	conf.Scopes = provider.route.JwtTokenAuth.Scopes

	token, err := getTokenSource(conf, ctx)
	if err != nil {
		return "", err
	}

	oauthJwtTokenCache.cache[provider.getAccessTokenCacheKey()] = token

	logger.Info("Got new access token", "ExpiresOn", token.Expiry)

	return token.AccessToken, nil
}

var getTokenSource = func(conf *jwt.Config, ctx context.Context) (*oauth2.Token, error) {
	tokenSrc := conf.TokenSource(ctx)
	token, err := tokenSrc.Token()
	if err != nil {
		return nil, err
	}

	return token, nil
}

func (provider *accessTokenProvider) getAccessTokenCacheKey() string {
	return fmt.Sprintf("%v_%v_%v_%v", provider.datasourceId, provider.datasourceVersion, provider.route.Path, provider.route.Method)
}

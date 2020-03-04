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
	// timeNow makes it possible to test usage of time
	timeNow = time.Now
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
	ExpiresOn   time.Time
	AccessToken string
}

func (token *jwtToken) UnmarshalJSON(b []byte) error {
	var t struct {
		AccessToken string       `json:"access_token"`
		ExpiresOn   *json.Number `json:"expires_on"`
		ExpiresIn   *json.Number `json:"expires_in"`
	}

	if err := json.Unmarshal(b, &t); err != nil {
		return err
	}

	token.AccessToken = t.AccessToken
	token.ExpiresOn = timeNow()

	if t.ExpiresOn != nil {
		expiresOn, err := t.ExpiresOn.Int64()
		if err != nil {
			return err
		}
		token.ExpiresOn = time.Unix(expiresOn, 0)
	} else if t.ExpiresIn != nil {
		expiresIn, err := t.ExpiresIn.Int64()
		if err != nil {
			return err
		}
		token.ExpiresOn = timeNow().Add(time.Duration(expiresIn) * time.Second)
	}

	return nil
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
		if cachedToken.ExpiresOn.After(timeNow().Add(time.Second * 10)) {
			logger.Info("Using token from cache")
			return cachedToken.AccessToken, nil
		}
	}

	urlInterpolated, err := InterpolateString(provider.route.TokenAuth.Url, data)
	if err != nil {
		return "", err
	}

	params := make(url.Values)
	for key, value := range provider.route.TokenAuth.Params {
		interpolatedParam, err := InterpolateString(value, data)
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

	tokenCache.cache[provider.getAccessTokenCacheKey()] = &token
	logger.Info("Got new access token", "ExpiresOn", token.ExpiresOn)
	return token.AccessToken, nil
}

func (provider *accessTokenProvider) getJwtAccessToken(ctx context.Context, data templateData) (string, error) {
	oauthJwtTokenCache.Lock()
	defer oauthJwtTokenCache.Unlock()
	if cachedToken, found := oauthJwtTokenCache.cache[provider.getAccessTokenCacheKey()]; found {
		if cachedToken.Expiry.After(timeNow().Add(time.Second * 10)) {
			logger.Debug("Using token from cache")
			return cachedToken.AccessToken, nil
		}
	}

	conf := &jwt.Config{}

	if val, ok := provider.route.JwtTokenAuth.Params["client_email"]; ok {
		interpolatedVal, err := InterpolateString(val, data)
		if err != nil {
			return "", err
		}
		conf.Email = interpolatedVal
	}

	if val, ok := provider.route.JwtTokenAuth.Params["private_key"]; ok {
		interpolatedVal, err := InterpolateString(val, data)
		if err != nil {
			return "", err
		}
		conf.PrivateKey = []byte(interpolatedVal)
	}

	if val, ok := provider.route.JwtTokenAuth.Params["token_uri"]; ok {
		interpolatedVal, err := InterpolateString(val, data)
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

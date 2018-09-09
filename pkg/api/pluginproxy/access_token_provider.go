package pluginproxy

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/plugins"
	"golang.org/x/oauth2/jwt"
)

var (
	tokenCache         = map[string]*jwtToken{}
	oauthJwtTokenCache = map[string]*oauth2.Token{}
)

type accessTokenProvider struct {
	route        *plugins.AppPluginRoute
	datasourceID int64
}

type jwtToken struct {
	ExpiresOn       time.Time `json:"-"`
	ExpiresOnString string    `json:"expires_on"`
	AccessToken     string    `json:"access_token"`
}

// Access token provider
func NewAccessTokenProvider(dsID int64, pluginRoute *plugins.AppPluginRoute) *accessTokenProvider {
	return &accessTokenProvider{
		datasourceID: dsID,
		route:        pluginRoute,
	}
}

func (provider *accessTokenProvider) getAccessToken(data templateData) (string, error) {
	if cachedToken, found := tokenCache[provider.getAccessTokenCacheKey()]; found {
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
	tokenCache[provider.getAccessTokenCacheKey()] = &token

	logger.Info("Got new access token", "ExpiresOn", token.ExpiresOn)

	return token.AccessToken, nil
}

func (provider *accessTokenProvider) getJwtAccessToken(ctx context.Context, data templateData) (string, error) {
	if cachedToken, found := oauthJwtTokenCache[provider.getAccessTokenCacheKey()]; found {
		if cachedToken.Expiry.After(time.Now().Add(time.Second * 10)) {
			logger.Info("Using token from cache")
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

	oauthJwtTokenCache[provider.getAccessTokenCacheKey()] = token

	return token.AccessToken, nil
}

var getTokenSource = func(conf *jwt.Config, ctx context.Context) (*oauth2.Token, error) {
	tokenSrc := conf.TokenSource(ctx)
	token, err := tokenSrc.Token()
	if err != nil {
		return nil, err
	}

	logger.Info("interpolatedVal", "token.AccessToken", token.AccessToken)

	return token, nil
}

func (provider *accessTokenProvider) getAccessTokenCacheKey() string {
	return fmt.Sprintf("%v_%v_%v", provider.datasourceID, provider.route.Path, provider.route.Method)
}

//Export access token lookup
func GetAccessTokenFromCache(datasourceID int64, path string, method string) (string, error) {
	key := fmt.Sprintf("%v_%v_%v", datasourceID, path, method)
	if cachedToken, found := oauthJwtTokenCache[key]; found {
		return cachedToken.AccessToken, nil
	} else {
		return "", fmt.Errorf("Key doesnt exist")
	}
}

package pluginproxy

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
)

var (
	tokenCache = tokenCacheType{
		cache: map[string]*jwtToken{},
	}
)

type tokenCacheType struct {
	cache map[string]*jwtToken
	sync.Mutex
}

type genericAccessTokenProvider struct {
	datasourceId      int64
	datasourceUpdated time.Time
	route             *plugins.Route
	authParams        *plugins.JWTTokenAuth
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

func newGenericAccessTokenProvider(ds DSInfo, pluginRoute *plugins.Route,
	authParams *plugins.JWTTokenAuth) *genericAccessTokenProvider {
	return &genericAccessTokenProvider{
		datasourceId:      ds.ID,
		datasourceUpdated: ds.Updated,
		route:             pluginRoute,
		authParams:        authParams,
	}
}

func (provider *genericAccessTokenProvider) GetAccessToken() (string, error) {
	tokenCache.Lock()
	defer tokenCache.Unlock()
	if cachedToken, found := tokenCache.cache[provider.getAccessTokenCacheKey()]; found {
		if cachedToken.ExpiresOn.After(timeNow().Add(time.Second * 10)) {
			logger.Info("Using token from cache")
			return cachedToken.AccessToken, nil
		}
	}

	tokenUrl := provider.authParams.Url

	params := make(url.Values)
	for key, value := range provider.authParams.Params {
		params.Add(key, value)
	}

	getTokenReq, err := http.NewRequest("POST", tokenUrl, bytes.NewBufferString(params.Encode()))
	if err != nil {
		return "", err
	}
	getTokenReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	getTokenReq.Header.Set("Content-Length", strconv.Itoa(len(params.Encode())))

	resp, err := client.Do(getTokenReq)
	if err != nil {
		return "", err
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()

	var token jwtToken
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return "", err
	}

	tokenCache.cache[provider.getAccessTokenCacheKey()] = &token
	logger.Info("Got new access token", "ExpiresOn", token.ExpiresOn)
	return token.AccessToken, nil
}

func (provider *genericAccessTokenProvider) getAccessTokenCacheKey() string {
	return fmt.Sprintf("%v_%v_%v_%v", provider.datasourceId, provider.datasourceUpdated.Unix(), provider.route.Path, provider.route.Method)
}

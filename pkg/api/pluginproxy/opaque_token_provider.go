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

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
)

var (
	opaqueTokenCache = opaqueTokenCacheType{
		cache: map[string]*opaqueToken{},
	}
)

type opaqueTokenCacheType struct {
	cache map[string]*opaqueToken
	sync.Mutex
}

type opaqueTokenProvider struct {
	route             *plugins.AppPluginRoute
	datasourceId      int64
	datasourceVersion int
}

type opaqueToken struct {
	ExpiresOn       time.Time `json:"-"`
	ExpiresOnString string    `json:"expires_on"`
	Token           string    `json:"sessionId"`
	UserId          string    `json:"userId"`
	Ttl             int       `json:"ttl"`
}

func newOpaqueTokenProvider(ds *models.DataSource, pluginRoute *plugins.AppPluginRoute) *opaqueTokenProvider {
	return &opaqueTokenProvider{
		datasourceId:      ds.Id,
		datasourceVersion: ds.Version,
		route:             pluginRoute,
	}
}

func (provider *opaqueTokenProvider) getOpaqueToken(data templateData, httpClient *http.Client) (string, error) {
	opaqueTokenCache.Lock()
	defer opaqueTokenCache.Unlock()
	if cachedToken, found := opaqueTokenCache.cache[provider.getOpaqueTokenCacheKey()]; found {
		if cachedToken.ExpiresOn.After(time.Now().Add(time.Second * 10)) {
			logger.Info("Using token from cache")
			return cachedToken.Token, nil
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

	token, err := getOpaqueTokenSource(urlInterpolated, params, httpClient)

	expiresOnEpoch, _ := strconv.ParseInt(token.ExpiresOnString, 10, 64)
	token.ExpiresOn = time.Unix(expiresOnEpoch, 0)
	opaqueTokenCache.cache[provider.getOpaqueTokenCacheKey()] = &token

	logger.Info("Got new access token", "ExpiresOn", token.ExpiresOn)

	return token.Token, nil
}

var getOpaqueTokenSource = func(urlInterpolated string, params url.Values, client *http.Client) (opaqueToken, error) {

	getTokenReq, _ := http.NewRequest("POST", urlInterpolated, bytes.NewBufferString(
		fmt.Sprintf(`{"username":"%s", "password":"%s"}`,
			params.Get("username"),
			params.Get("password"))))
	getTokenReq.Header.Add("Content-Type", "application/json")

	resp, err := client.Do(getTokenReq)
	if err != nil {
		return opaqueToken{}, err
	}

	defer resp.Body.Close()

	var token opaqueToken
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return opaqueToken{}, err
	}
	// if the actual expiration time isn't set on the response
	if len(token.ExpiresOnString) == 0 {
		// Set the expiration time to half the ttl value to ensure it gets invalidated in cache before it
		// actually expires. Using half the ttl instead of calculating response time on the request to mint
		// the token to allow a larger buffer for error
		token.ExpiresOn = time.Now().Add(time.Second * time.Duration(token.Ttl/2))
		token.ExpiresOnString = token.ExpiresOn.String()
	}

	return token, nil
}

func (provider *opaqueTokenProvider) getOpaqueTokenCacheKey() string {
	return fmt.Sprintf("%v_%v_%v_%v", provider.datasourceId, provider.datasourceVersion, provider.route.Path, provider.route.Method)
}

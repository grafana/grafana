package mqe

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"time"

	"golang.org/x/net/context/ctxhttp"

	"strconv"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/patrickmn/go-cache"
)

var tokenCache *cache.Cache

func init() {
	tokenCache = cache.New(5*time.Minute, 30*time.Second)
}

type TokenClient struct {
	log        log.Logger
	Datasource *models.DataSource
	HttpClient *http.Client
}

func NewTokenClient(datasource *models.DataSource) *TokenClient {
	httpClient, _ := datasource.GetHttpClient()

	return &TokenClient{
		log:        log.New("tsdb.mqe.tokenclient"),
		Datasource: datasource,
		HttpClient: httpClient,
	}
}

func (client *TokenClient) GetTokenData(ctx context.Context) (*TokenBody, error) {
	key := strconv.FormatInt(client.Datasource.Id, 10)

	item, found := tokenCache.Get(key)
	if found {
		if result, ok := item.(*TokenBody); ok {
			return result, nil
		}
	}

	b, err := client.RequestTokenData(ctx)
	if err != nil {
		return nil, err
	}

	tokenCache.Set(key, b, cache.DefaultExpiration)

	return b, nil
}

func (client *TokenClient) RequestTokenData(ctx context.Context) (*TokenBody, error) {
	u, _ := url.Parse(client.Datasource.Url)
	u.Path = path.Join(u.Path, "token")

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		client.log.Info("Failed to create request", "error", err)
	}

	res, err := ctxhttp.Do(ctx, client.HttpClient, req)
	if err != nil {
		return nil, err
	}

	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		return nil, err
	}

	if res.StatusCode/100 != 2 {
		client.log.Info("Request failed", "status", res.Status, "body", string(body))
		return nil, fmt.Errorf("Request failed status: %v", res.Status)
	}

	var result *TokenResponse
	err = json.Unmarshal(body, &result)
	if err != nil {
		client.log.Info("Failed to unmarshal response", "error", err, "status", res.Status, "body", string(body))
		return nil, err
	}

	if !result.Success {
		return nil, fmt.Errorf("Request failed for unknown reason.")
	}

	return &result.Body, nil
}

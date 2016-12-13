package mqe

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"

	"golang.org/x/net/context/ctxhttp"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
)

type TokenClient struct {
	tlog       log.Logger
	Datasource *models.DataSource
	HttpClient *http.Client
}

func NewTokenClient(datasource *models.DataSource) *TokenClient {
	httpClient, _ := datasource.GetHttpClient()

	return &TokenClient{
		tlog:       log.New("tsdb.mqe.tokenclient"),
		Datasource: datasource,
		HttpClient: httpClient,
	}
}

var cache map[int64]*TokenBody = map[int64]*TokenBody{}

//Replace this stupid cache with internal cache from grafana master before merging
func (client *TokenClient) GetTokenData(ctx context.Context) (*TokenBody, error) {
	_, excist := cache[client.Datasource.Id]
	if !excist {
		b, err := client.RequestTokenData(ctx)
		if err != nil {
			return nil, err
		}

		cache[client.Datasource.Id] = b
	}

	return cache[client.Datasource.Id], nil
}

func (client *TokenClient) RequestTokenData(ctx context.Context) (*TokenBody, error) {
	u, _ := url.Parse(client.Datasource.Url)
	u.Path = path.Join(u.Path, "token")

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		client.tlog.Info("Failed to create request", "error", err)
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
		client.tlog.Info("Request failed", "status", res.Status, "body", string(body))
		return nil, fmt.Errorf("Request failed status: %v", res.Status)
	}

	var result *TokenResponse
	err = json.Unmarshal(body, &result)
	if err != nil {
		client.tlog.Info("Failed to unmarshal graphite response", "error", err, "status", res.Status, "body", string(body))
		return nil, err
	}

	if !result.Success {
		return nil, fmt.Errorf("Request failed for unknown reason.")
	}

	return &result.Body, nil
}

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
	"github.com/grafana/grafana/pkg/tsdb"
)

type TokenClient struct {
	tlog log.Logger
}

func NewTokenClient() *TokenClient {
	return &TokenClient{
		tlog: log.New("tsdb.mqe.tokenclient"),
	}
}

func (client *TokenClient) GetTokenData(ctx context.Context, datasource *tsdb.DataSourceInfo) (*TokenResponse, error) {
	u, _ := url.Parse(datasource.Url)
	u.Path = path.Join(u.Path, "token")

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		client.tlog.Info("Failed to create request", "error", err)
	}

	res, err := ctxhttp.Do(ctx, HttpClient, req)
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

	return result, nil
}

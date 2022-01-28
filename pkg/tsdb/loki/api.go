package loki

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	parsers "github.com/grafana/grafana/pkg/tsdb/prometheus/parser"
	"github.com/grafana/loki/pkg/loghttp"
	jsoniter "github.com/json-iterator/go"
)

type LokiAPI struct {
	client *http.Client
	url    string
}

func NewLokiAPI(client *http.Client, url string) *LokiAPI {
	return &LokiAPI{client: client, url: url}
}

func makeRequest(ctx context.Context, lokiDsUrl string, query lokiQuery) (*http.Request, error) {
	qs := url.Values{}
	qs.Set("query", query.Expr)
	qs.Set("step", query.Step.String())
	qs.Set("start", strconv.FormatInt(query.Start.UnixNano(), 10))
	qs.Set("end", strconv.FormatInt(query.End.UnixNano(), 10))

	lokiUrl, err := url.Parse(lokiDsUrl)
	if err != nil {
		return nil, err
	}

	lokiUrl.Path = "/loki/api/v1/query_range"
	lokiUrl.RawQuery = qs.Encode()

	req, err := http.NewRequestWithContext(ctx, "GET", lokiUrl.String(), nil)
	if err != nil {
		return nil, err
	}

	// if query.VolumeQuery {
	// 	req.Header.Set("X-Query-Tags", "Source=logvolhist")
	// }

	return req, nil
}

func (api *LokiAPI) QueryRangeUsingLokiStructures(ctx context.Context, query lokiQuery) (*loghttp.QueryResponse, error) {
	req, err := makeRequest(ctx, api.url, query)
	if err != nil {
		return nil, err
	}

	resp, err := api.client.Do(req)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	var response loghttp.QueryResponse
	err = jsoniter.NewDecoder(resp.Body).Decode(&response)
	if err != nil {
		return nil, err
	}

	return &response, nil
}

func (api *LokiAPI) QueryRangeIter(ctx context.Context, query lokiQuery) (*backend.DataResponse, error) {
	req, err := makeRequest(ctx, api.url, query)
	if err != nil {
		return nil, err
	}

	resp, err := api.client.Do(req)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	iter := jsoniter.Parse(jsoniter.ConfigDefault, resp.Body, 1024)
	fmt.Println("iter-parsing started")
	res := parsers.ReadPrometheusStyleResult(iter)
	fmt.Println("iter-parsing ended")
	return res, nil
}

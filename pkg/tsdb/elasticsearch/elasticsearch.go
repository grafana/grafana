package elasticsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"golang.org/x/net/context/ctxhttp"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
)

type ElasticsearchExecutor struct {
	QueryParser *ElasticSearchQueryParser
	Transport   *http.Transport
}

var (
	glog               log.Logger
	intervalCalculator tsdb.IntervalCalculator
)

func NewElasticsearchExecutor(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	transport, err := dsInfo.GetHttpTransport()
	if err != nil {
		return nil, err
	}

	return &ElasticsearchExecutor{
		Transport: transport,
	}, nil
}

func init() {
	glog = log.New("tsdb.elasticsearch")
	tsdb.RegisterTsdbQueryEndpoint("elasticsearch", NewElasticsearchExecutor)
	intervalCalculator = tsdb.NewIntervalCalculator(&tsdb.IntervalOptions{MinInterval: time.Millisecond * 1})
}

func (e *ElasticsearchExecutor) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{}
	result.Results = make(map[string]*tsdb.QueryResult)

	queries, err := e.getQuery(dsInfo, tsdbQuery)
	if err != nil {
		return nil, err
	}

	buff := bytes.Buffer{}
	for _, q := range queries {
		s, err := q.Build(tsdbQuery, dsInfo)
		if err != nil {
			return nil, err
		}
		buff.WriteString(s)
	}
	payload := buff.String()

	if setting.Env == setting.DEV {
		glog.Debug("Elasticsearch playload", "raw playload", payload)
	}
	glog.Info("Elasticsearch playload", "raw playload", payload)

	req, err := e.createRequest(dsInfo, payload)
	if err != nil {
		return nil, err
	}

	httpClient, err := dsInfo.GetHttpClient()
	if err != nil {
		return nil, err
	}

	resp, err := ctxhttp.Do(ctx, httpClient, req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("elasticsearch returned statuscode invalid status code: %v", resp.Status)
	}

	var responses Responses
	dec := json.NewDecoder(resp.Body)
	defer resp.Body.Close()
	dec.UseNumber()
	err = dec.Decode(&responses)
	if err != nil {
		return nil, err
	}

	for _, res := range responses.Responses {
		if res.Err != nil {
			return nil, errors.New(res.getErrMsg())
		}
	}
	responseParser := ElasticsearchResponseParser{responses.Responses, queries}
	queryRes := responseParser.getTimeSeries()
	result.Results["A"] = queryRes
	return result, nil
}

func (e *ElasticsearchExecutor) getQuery(dsInfo *models.DataSource, context *tsdb.TsdbQuery) ([]*Query, error) {
	queries := make([]*Query, 0)
	if len(context.Queries) == 0 {
		return nil, fmt.Errorf("query request contains no queries")
	}
	for _, v := range context.Queries {

		query, err := e.QueryParser.Parse(v.Model, dsInfo)
		if err != nil {
			return nil, err
		}
		queries = append(queries, query)

	}
	return queries, nil

}

func (e *ElasticsearchExecutor) createRequest(dsInfo *models.DataSource, query string) (*http.Request, error) {
	u, _ := url.Parse(dsInfo.Url)
	u.Path = path.Join(u.Path, "_msearch")
	req, err := http.NewRequest(http.MethodPost, u.String(), strings.NewReader(query))
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Grafana")
	req.Header.Set("Content-Type", "application/json")

	if dsInfo.BasicAuth {
		req.SetBasicAuth(dsInfo.BasicAuthUser, dsInfo.BasicAuthPassword)
	}

	if !dsInfo.BasicAuth && dsInfo.User != "" {
		req.SetBasicAuth(dsInfo.User, dsInfo.Password)
	}

	glog.Debug("Elasticsearch request", "url", req.URL.String())
	glog.Debug("Elasticsearch request", "body", query)
	return req, nil
}

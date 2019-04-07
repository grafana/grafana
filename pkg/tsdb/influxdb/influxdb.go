package influxdb

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"golang.org/x/net/context/ctxhttp"
)

type InfluxDBExecutor struct {
	//*models.DataSource
	QueryParser    *InfluxdbQueryParser
	ResponseParser *ResponseParser
	//HttpClient     *http.Client
}

func NewInfluxDBExecutor(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	return &InfluxDBExecutor{
		QueryParser:    &InfluxdbQueryParser{},
		ResponseParser: &ResponseParser{},
	}, nil
}

var (
	glog log.Logger
)

func init() {
	glog = log.New("tsdb.influxdb")
	tsdb.RegisterTsdbQueryEndpoint("influxdb", NewInfluxDBExecutor)
}

func (e *InfluxDBExecutor) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{}

	query, err := e.getQuery(dsInfo, tsdbQuery.Queries, tsdbQuery)
	if err != nil {
		return nil, err
	}

	rawQuery, err := query.Build(tsdbQuery)
	if err != nil {
		return nil, err
	}

	if setting.Env == setting.DEV {
		glog.Debug("Influxdb query", "raw query", rawQuery)
	}

	req, err := e.createRequest(dsInfo, rawQuery)
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

	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("Influxdb returned statuscode invalid status code: %v", resp.Status)
	}

	var response Response
	dec := json.NewDecoder(resp.Body)
	dec.UseNumber()
	err = dec.Decode(&response)

	if err != nil {
		return nil, err
	}

	if response.Err != nil {
		return nil, response.Err
	}

	result.Results = make(map[string]*tsdb.QueryResult)
	result.Results["A"] = e.ResponseParser.Parse(&response, query)

	return result, nil
}

func (e *InfluxDBExecutor) getQuery(dsInfo *models.DataSource, queries []*tsdb.Query, context *tsdb.TsdbQuery) (*Query, error) {
	// The model supports multiple queries, but right now this is only used from
	// alerting so we only needed to support batch executing 1 query at a time.
	if len(queries) > 0 {
		query, err := e.QueryParser.Parse(queries[0].Model, dsInfo)
		if err != nil {
			return nil, err
		}
		return query, nil
	}
	return nil, fmt.Errorf("query request contains no queries")
}

func (e *InfluxDBExecutor) createRequest(dsInfo *models.DataSource, query string) (*http.Request, error) {
	u, _ := url.Parse(dsInfo.Url)
	u.Path = path.Join(u.Path, "query")

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}

	params := req.URL.Query()
	params.Set("q", query)
	params.Set("db", dsInfo.Database)
	params.Set("epoch", "s")
	req.URL.RawQuery = params.Encode()

	req.Header.Set("User-Agent", "Grafana")

	if dsInfo.BasicAuth {
		req.SetBasicAuth(dsInfo.BasicAuthUser, dsInfo.DecryptedBasicAuthPassword())
	}

	if !dsInfo.BasicAuth && dsInfo.User != "" {
		req.SetBasicAuth(dsInfo.User, dsInfo.DecryptedPassword())
	}

	glog.Debug("Influxdb request", "url", req.URL.String())
	return req, nil
}

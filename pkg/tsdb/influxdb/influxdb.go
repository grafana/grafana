package influxdb

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"

	"golang.org/x/net/context/ctxhttp"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
)

type InfluxDBExecutor struct {
	*models.DataSource
	QueryParser    *InfluxdbQueryParser
	ResponseParser *ResponseParser
	HttpClient     *http.Client
}

func NewInfluxDBExecutor(datasource *models.DataSource) (tsdb.Executor, error) {
	httpClient, err := datasource.GetHttpClient()

	if err != nil {
		return nil, err
	}

	return &InfluxDBExecutor{
		DataSource:     datasource,
		QueryParser:    &InfluxdbQueryParser{},
		ResponseParser: &ResponseParser{},
		HttpClient:     httpClient,
	}, nil
}

var (
	glog log.Logger
)

func init() {
	glog = log.New("tsdb.influxdb")
	tsdb.RegisterExecutor("influxdb", NewInfluxDBExecutor)
}

func (e *InfluxDBExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, context *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}

	query, err := e.getQuery(queries, context)
	if err != nil {
		return result.WithError(err)
	}

	rawQuery, err := query.Build(context)
	if err != nil {
		return result.WithError(err)
	}

	if setting.Env == setting.DEV {
		glog.Debug("Influxdb query", "raw query", rawQuery)
	}

	req, err := e.createRequest(rawQuery)
	if err != nil {
		return result.WithError(err)
	}

	resp, err := ctxhttp.Do(ctx, e.HttpClient, req)
	if err != nil {
		return result.WithError(err)
	}

	if resp.StatusCode/100 != 2 {
		return result.WithError(fmt.Errorf("Influxdb returned statuscode invalid status code: %v", resp.Status))
	}

	var response Response
	dec := json.NewDecoder(resp.Body)
	defer resp.Body.Close()
	dec.UseNumber()
	err = dec.Decode(&response)

	if err != nil {
		return result.WithError(err)
	}

	if response.Err != nil {
		return result.WithError(response.Err)
	}

	result.QueryResults = make(map[string]*tsdb.QueryResult)
	result.QueryResults["A"] = e.ResponseParser.Parse(&response, query)

	return result
}

func (e *InfluxDBExecutor) getQuery(queries tsdb.QuerySlice, context *tsdb.QueryContext) (*Query, error) {
	for _, v := range queries {

		query, err := e.QueryParser.Parse(v.Model, e.DataSource)
		if err != nil {
			return nil, err
		}

		return query, nil
	}

	return nil, fmt.Errorf("query request contains no queries")
}

func (e *InfluxDBExecutor) createRequest(query string) (*http.Request, error) {
	u, _ := url.Parse(e.Url)
	u.Path = path.Join(u.Path, "query")

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}

	params := req.URL.Query()
	params.Set("q", query)
	params.Set("db", e.Database)
	params.Set("epoch", "s")
	req.URL.RawQuery = params.Encode()

	req.Header.Set("User-Agent", "Grafana")

	if e.BasicAuth {
		req.SetBasicAuth(e.BasicAuthUser, e.BasicAuthPassword)
	}

	if !e.BasicAuth && e.User != "" {
		req.SetBasicAuth(e.User, e.Password)
	}

	glog.Debug("Influxdb request", "url", req.URL.String())
	return req, nil
}

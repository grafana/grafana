package influxdb

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"time"

	"golang.org/x/net/context/ctxhttp"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"
)

type InfluxDBExecutor struct {
	*tsdb.DataSourceInfo
	QueryParser    *InfluxdbQueryParser
	QueryBuilder   *QueryBuilder
	ResponseParser *ResponseParser
}

func NewInfluxDBExecutor(dsInfo *tsdb.DataSourceInfo) tsdb.Executor {
	return &InfluxDBExecutor{
		DataSourceInfo: dsInfo,
		QueryParser:    &InfluxdbQueryParser{},
		QueryBuilder:   &QueryBuilder{},
		ResponseParser: &ResponseParser{},
	}
}

var (
	glog       log.Logger
	HttpClient *http.Client
)

func init() {
	glog = log.New("tsdb.influxdb")
	tsdb.RegisterExecutor("influxdb", NewInfluxDBExecutor)

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	HttpClient = &http.Client{
		Timeout:   time.Duration(15 * time.Second),
		Transport: tr,
	}
}

func (e *InfluxDBExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, context *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}

	query, err := e.getQuery(queries, context)
	if err != nil {
		return result.WithError(err)
	}

	glog.Debug("Influxdb query", "raw query", query)

	req, err := e.createRequest(query)
	if err != nil {
		return result.WithError(err)
	}

	resp, err := ctxhttp.Do(ctx, HttpClient, req)
	if err != nil {
		return result.WithError(err)
	}

	if resp.StatusCode/100 != 2 {
		return result.WithError(fmt.Errorf("Influxdb returned statuscode invalid status code: %v", resp.Status))
	}

	var response Response
	dec := json.NewDecoder(resp.Body)
	dec.UseNumber()
	err = dec.Decode(&response)
	if err != nil {
		return result.WithError(err)
	}

	result.QueryResults = make(map[string]*tsdb.QueryResult)
	result.QueryResults["A"] = e.ResponseParser.Parse(&response)

	return result
}

func (e *InfluxDBExecutor) getQuery(queries tsdb.QuerySlice, context *tsdb.QueryContext) (string, error) {
	for _, v := range queries {

		query, err := e.QueryParser.Parse(v.Model, e.DataSourceInfo)
		if err != nil {
			return "", err
		}

		rawQuery, err := e.QueryBuilder.Build(query, context)
		if err != nil {
			return "", err
		}

		return rawQuery, nil
	}

	return "", fmt.Errorf("query request contains no queries")
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

	glog.Debug("Influxdb request", "url", req.URL.String())
	return req, nil
}

package influxdb

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/flux"
)

type InfluxDBExecutor struct {
	//*models.DataSource
	QueryParser    *InfluxdbQueryParser
	ResponseParser *ResponseParser
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

var ErrInvalidHttpMode error = errors.New("'httpMode' should be either 'GET' or 'POST'")

func init() {
	glog = log.New("tsdb.influxdb")
	tsdb.RegisterTsdbQueryEndpoint("influxdb", NewInfluxDBExecutor)
}

func (e *InfluxDBExecutor) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	glog.Debug("Received a query request", "numQueries", len(tsdbQuery.Queries))

	version := dsInfo.JsonData.Get("version").MustString("")
	if version == "Flux" {
		return flux.Query(ctx, dsInfo, tsdbQuery)
	}

	glog.Debug("Making a non-Flux type query")

	// NOTE: the following path is currently only called from alerting queries
	// In dashboards, the request runs through proxy and are managed in the frontend

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

	req, err := e.createRequest(ctx, dsInfo, rawQuery)
	if err != nil {
		return nil, err
	}

	httpClient, err := dsInfo.GetHttpClient()
	if err != nil {
		return nil, err
	}

	resp, err := httpClient.Do(req)
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
	if err := dec.Decode(&response); err != nil {
		return nil, err
	}
	if response.Err != nil {
		return nil, response.Err
	}

	result := &tsdb.Response{}
	result.Results = make(map[string]*tsdb.QueryResult)
	result.Results["A"] = e.ResponseParser.Parse(&response, query)

	return result, nil
}

func (e *InfluxDBExecutor) getQuery(dsInfo *models.DataSource, queries []*tsdb.Query, context *tsdb.TsdbQuery) (*Query, error) {
	if len(queries) == 0 {
		return nil, fmt.Errorf("query request contains no queries")
	}

	// The model supports multiple queries, but right now this is only used from
	// alerting so we only needed to support batch executing 1 query at a time.
	query, err := e.QueryParser.Parse(queries[0].Model, dsInfo)
	if err != nil {
		return nil, err
	}
	return query, nil
}

func (e *InfluxDBExecutor) createRequest(ctx context.Context, dsInfo *models.DataSource, query string) (*http.Request, error) {
	u, err := url.Parse(dsInfo.Url)
	if err != nil {
		return nil, err
	}

	u.Path = path.Join(u.Path, "query")
	httpMode := dsInfo.JsonData.Get("httpMode").MustString("GET")

	var req *http.Request
	switch httpMode {
	case "GET":
		req, err = http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
		if err != nil {
			return nil, err
		}
	case "POST":
		bodyValues := url.Values{}
		bodyValues.Add("q", query)
		body := bodyValues.Encode()
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, u.String(), strings.NewReader(body))
		if err != nil {
			return nil, err
		}
	default:
		return nil, ErrInvalidHttpMode
	}

	req.Header.Set("User-Agent", "Grafana")

	params := req.URL.Query()
	params.Set("db", dsInfo.Database)
	params.Set("epoch", "s")

	if httpMode == "GET" {
		params.Set("q", query)
	} else if httpMode == "POST" {
		req.Header.Set("Content-type", "application/x-www-form-urlencoded")
	}

	req.URL.RawQuery = params.Encode()

	if dsInfo.BasicAuth {
		req.SetBasicAuth(dsInfo.BasicAuthUser, dsInfo.DecryptedBasicAuthPassword())
	}

	if !dsInfo.BasicAuth && dsInfo.User != "" {
		req.SetBasicAuth(dsInfo.User, dsInfo.DecryptedPassword())
	}

	glog.Debug("Influxdb request", "url", req.URL.String())
	return req, nil
}

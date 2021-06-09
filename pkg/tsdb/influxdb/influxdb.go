package influxdb

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/flux"
)

type Executor struct {
	httpClientProvider httpclient.Provider
	QueryParser        *InfluxdbQueryParser
	ResponseParser     *ResponseParser
}

// nolint:staticcheck // plugins.DataPlugin deprecated
func New(httpClientProvider httpclient.Provider) func(*models.DataSource) (plugins.DataPlugin, error) {
	// nolint:staticcheck // plugins.DataPlugin deprecated
	return func(dsInfo *models.DataSource) (plugins.DataPlugin, error) {
		return &Executor{
			httpClientProvider: httpClientProvider,
			QueryParser:        &InfluxdbQueryParser{},
			ResponseParser:     &ResponseParser{},
		}, nil
	}
}

var (
	glog log.Logger
)

var ErrInvalidHttpMode error = errors.New("'httpMode' should be either 'GET' or 'POST'")

func init() {
	glog = log.New("tsdb.influxdb")
}

//nolint: staticcheck // plugins.DataResponse deprecated
func (e *Executor) DataQuery(ctx context.Context, dsInfo *models.DataSource, tsdbQuery plugins.DataQuery) (
	plugins.DataResponse, error) {
	glog.Debug("Received a query request", "numQueries", len(tsdbQuery.Queries))

	version := dsInfo.JsonData.Get("version").MustString("")
	if version == "Flux" {
		return flux.Query(ctx, e.httpClientProvider, dsInfo, tsdbQuery)
	}

	glog.Debug("Making a non-Flux type query")

	// NOTE: the following path is currently only called from alerting queries
	// In dashboards, the request runs through proxy and are managed in the frontend

	query, err := e.getQuery(dsInfo, tsdbQuery)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	rawQuery, err := query.Build(tsdbQuery)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	if setting.Env == setting.Dev {
		glog.Debug("Influxdb query", "raw query", rawQuery)
	}

	req, err := e.createRequest(ctx, dsInfo, rawQuery)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	httpClient, err := dsInfo.GetHTTPClient(e.httpClientProvider)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return plugins.DataResponse{}, err
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			glog.Warn("Failed to close response body", "err", err)
		}
	}()
	if resp.StatusCode/100 != 2 {
		return plugins.DataResponse{}, fmt.Errorf("InfluxDB returned error status: %s", resp.Status)
	}

	result := plugins.DataResponse{
		Results: map[string]plugins.DataQueryResult{
			"A": e.ResponseParser.Parse(resp.Body, query),
		},
	}

	return result, nil
}

func (e *Executor) getQuery(dsInfo *models.DataSource, query plugins.DataQuery) (*Query, error) {
	if len(query.Queries) == 0 {
		return nil, fmt.Errorf("query request contains no queries")
	}

	// The model supports multiple queries, but right now this is only used from
	// alerting so we only needed to support batch executing 1 query at a time.
	return e.QueryParser.Parse(query.Queries[0].Model, dsInfo)
}

func (e *Executor) createRequest(ctx context.Context, dsInfo *models.DataSource, query string) (*http.Request, error) {
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

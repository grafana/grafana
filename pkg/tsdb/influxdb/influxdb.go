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

	"gopkg.in/guregu/null.v3"

	"golang.org/x/net/context/ctxhttp"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"
)

type InfluxDBExecutor struct {
	*tsdb.DataSourceInfo
	QueryParser  *InfluxdbQueryParser
	QueryBuilder *QueryBuild
}

func NewInfluxDBExecutor(dsInfo *tsdb.DataSourceInfo) tsdb.Executor {
	return &InfluxDBExecutor{
		DataSourceInfo: dsInfo,
		QueryParser:    &InfluxdbQueryParser{},
		QueryBuilder:   &QueryBuild{},
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

func (e *InfluxDBExecutor) getQuery(queries tsdb.QuerySlice, context *tsdb.QueryContext) (string, error) {
	for _, v := range queries {
		query, err := e.QueryParser.Parse(v.Model)
		if err != nil {
			return "", err
		}

		rawQuery, err := e.QueryBuilder.Build(query, context)
		if err != nil {
			return "", err
		}

		return rawQuery, nil
	}

	return "", fmt.Errorf("Tsdb request contains no queries")
}

func (e *InfluxDBExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, context *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}

	query, err := e.getQuery(queries, context)
	if err != nil {
		result.Error = err
		return result
	}

	glog.Info("Influxdb", "query", query)

	u, _ := url.Parse(e.Url)
	u.Path = path.Join(u.Path, "query")

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		result.Error = err
		return result
	}

	params := req.URL.Query()
	params.Set("q", query)
	params.Set("db", e.Database)
	params.Set("epoch", "s")

	req.URL.RawQuery = params.Encode()

	req.Header.Set("Content-Type", "")
	req.Header.Set("User-Agent", "Grafana")
	if e.BasicAuth {
		req.SetBasicAuth(e.BasicAuthUser, e.BasicAuthPassword)
	}

	glog.Info("influxdb request", "url", req.URL.String())
	resp, err := ctxhttp.Do(ctx, HttpClient, req)
	if err != nil {
		result.Error = err
		return result
	}

	if resp.StatusCode/100 != 2 {
		result.Error = fmt.Errorf("Influxdb returned statuscode %v body %v", resp.Status)
		return result
	}

	var response Response
	dec := json.NewDecoder(resp.Body)
	dec.UseNumber()
	err = dec.Decode(&response)
	if err != nil {
		glog.Error("Influxdb decode failed", "err", err)
		result.Error = err
		return result
	}

	result.QueryResults = make(map[string]*tsdb.QueryResult)
	queryRes := tsdb.NewQueryResult()

	for _, v := range response.Results {
		for _, r := range v.Series {
			serie := tsdb.TimeSeries{Name: r.Name}
			var points tsdb.TimeSeriesPoints

			for _, k := range r.Values {
				var value null.Float
				var err error
				num, ok := k[1].(json.Number)
				if !ok {
					value = null.FloatFromPtr(nil)
				} else {
					fvalue, err := num.Float64()
					if err == nil {
						value = null.FloatFrom(fvalue)
					}
				}

				pos0, ok := k[0].(json.Number)
				timestamp, err := pos0.Float64()
				if err == nil && ok {
					points = append(points, tsdb.NewTimePoint(value, timestamp))
				} else {
					glog.Error("Failed to convert response", "err1", err, "ok", ok, "timestamp", timestamp, "value", value.Float64)
				}
				serie.Points = points
			}
			queryRes.Series = append(queryRes.Series, &serie)
		}
	}

	for _, v := range queryRes.Series {
		glog.Info("result", "name", v.Name, "points", v.Points)
	}

	result.QueryResults["A"] = queryRes

	return result
}

type Response struct {
	Results []Result
	Err     error
}

type Result struct {
	Series   []Row
	Messages []*Message
	Err      error
}

type Message struct {
	Level string `json:"level,omitempty"`
	Text  string `json:"text,omitempty"`
}

type Row struct {
	Name    string            `json:"name,omitempty"`
	Tags    map[string]string `json:"tags,omitempty"`
	Columns []string          `json:"columns,omitempty"`
	Values  [][]interface{}   `json:"values,omitempty"`
}

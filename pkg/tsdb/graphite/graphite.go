package graphite

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strings"

	"golang.org/x/net/context/ctxhttp"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/opentracing/opentracing-go"
)

type GraphiteExecutor struct {
	HttpClient *http.Client
}

func NewGraphiteExecutor(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	return &GraphiteExecutor{}, nil
}

var glog = log.New("tsdb.graphite")

func init() {
	tsdb.RegisterTsdbQueryEndpoint("graphite", NewGraphiteExecutor)
}

func (e *GraphiteExecutor) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{}

	from := "-" + formatTimeRange(tsdbQuery.TimeRange.From)
	until := formatTimeRange(tsdbQuery.TimeRange.To)
	var target string

	formData := url.Values{
		"from":          []string{from},
		"until":         []string{until},
		"format":        []string{"json"},
		"maxDataPoints": []string{"500"},
	}

	for _, query := range tsdbQuery.Queries {
		glog.Debug("graphite", "query", query.Model)
		if fullTarget, err := query.Model.Get("targetFull").String(); err == nil {
			target = fixIntervalFormat(fullTarget)
		} else {
			target = fixIntervalFormat(query.Model.Get("target").MustString())
		}
	}

	formData["target"] = []string{target}

	if setting.Env == setting.DEV {
		glog.Debug("Graphite request", "params", formData)
	}

	req, err := e.createRequest(dsInfo, formData)
	if err != nil {
		return nil, err
	}

	httpClient, err := dsInfo.GetHttpClient()
	if err != nil {
		return nil, err
	}

	span, ctx := opentracing.StartSpanFromContext(ctx, "graphite query")
	span.SetTag("target", target)
	span.SetTag("from", from)
	span.SetTag("until", until)
	span.SetTag("datasource_id", dsInfo.Id)
	span.SetTag("org_id", dsInfo.OrgId)

	defer span.Finish()

	opentracing.GlobalTracer().Inject(
		span.Context(),
		opentracing.HTTPHeaders,
		opentracing.HTTPHeadersCarrier(req.Header))

	res, err := ctxhttp.Do(ctx, httpClient, req)
	if err != nil {
		return nil, err
	}

	data, err := e.parseResponse(res)
	if err != nil {
		return nil, err
	}

	result.Results = make(map[string]*tsdb.QueryResult)
	queryRes := tsdb.NewQueryResult()

	for _, series := range data {
		queryRes.Series = append(queryRes.Series, &tsdb.TimeSeries{
			Name:   series.Target,
			Points: series.DataPoints,
		})

		if setting.Env == setting.DEV {
			glog.Debug("Graphite response", "target", series.Target, "datapoints", len(series.DataPoints))
		}
	}

	result.Results["A"] = queryRes
	return result, nil
}

func (e *GraphiteExecutor) parseResponse(res *http.Response) ([]TargetResponseDTO, error) {
	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		return nil, err
	}

	if res.StatusCode/100 != 2 {
		glog.Info("Request failed", "status", res.Status, "body", string(body))
		return nil, fmt.Errorf("Request failed status: %v", res.Status)
	}

	var data []TargetResponseDTO
	err = json.Unmarshal(body, &data)
	if err != nil {
		glog.Info("Failed to unmarshal graphite response", "error", err, "status", res.Status, "body", string(body))
		return nil, err
	}

	return data, nil
}

func (e *GraphiteExecutor) createRequest(dsInfo *models.DataSource, data url.Values) (*http.Request, error) {
	u, _ := url.Parse(dsInfo.Url)
	u.Path = path.Join(u.Path, "render")

	req, err := http.NewRequest(http.MethodPost, u.String(), strings.NewReader(data.Encode()))
	if err != nil {
		glog.Info("Failed to create request", "error", err)
		return nil, fmt.Errorf("Failed to create request. error: %v", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if dsInfo.BasicAuth {
		req.SetBasicAuth(dsInfo.BasicAuthUser, dsInfo.DecryptedBasicAuthPassword())
	}

	return req, err
}

func formatTimeRange(input string) string {
	if input == "now" {
		return input
	}
	return strings.Replace(strings.Replace(strings.Replace(input, "now", "", -1), "m", "min", -1), "M", "mon", -1)
}

func fixIntervalFormat(target string) string {
	rMinute := regexp.MustCompile(`'(\d+)m'`)
	target = rMinute.ReplaceAllStringFunc(target, func(m string) string {
		return strings.Replace(m, "m", "min", -1)
	})
	rMonth := regexp.MustCompile(`'(\d+)M'`)
	target = rMonth.ReplaceAllStringFunc(target, func(M string) string {
		return strings.Replace(M, "M", "mon", -1)
	})
	return target
}

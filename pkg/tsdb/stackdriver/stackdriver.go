package stackdriver

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

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/opentracing/opentracing-go"
)

type StackdriverExecutor struct {
	HttpClient *http.Client
}

func NewStackdriverExecutor(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	return &StackdriverExecutor{}, nil
}

var glog = log.New("tsdb.stackdriver")

func init() {
	tsdb.RegisterTsdbQueryEndpoint("stackdriver", NewStackdriverExecutor)
}

func (e *StackdriverExecutor) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{}
	logger.Info("tsdbQuery", "tsdbQuery", tsdbQuery)
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
		glog.Info("stackdriver", "query", query.Model)
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

	span, ctx := opentracing.StartSpanFromContext(ctx, "stackdriver query")
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

	for _, series := range data.TimeSeries {
		queryRes.Series = append(queryRes.Series, &tsdb.TimeSeries{
			Name: series.Metric.Type,
			// Points: [],
		})

		if setting.Env == setting.DEV {
			// glog.Debug("Graphite response", "target", series.Target, "datapoints", len(series.DataPoints))
		}
	}

	result.Results["A"] = queryRes
	return result, nil
}

func (e *StackdriverExecutor) parseResponse(res *http.Response) (StackDriverResponse, error) {
	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		return StackDriverResponse{}, err
	}

	if res.StatusCode/100 != 2 {
		glog.Info("Request failed", "status", res.Status, "body", string(body))
		return StackDriverResponse{}, fmt.Errorf("Request failed status: %v", res.Status)
	}

	var data StackDriverResponse
	err = json.Unmarshal(body, &data)
	if err != nil {
		glog.Info("Failed to unmarshal graphite response", "error", err, "status", res.Status, "body", string(body))
		return StackDriverResponse{}, err
	}

	return data, nil
}

func (e *StackdriverExecutor) createRequest(dsInfo *models.DataSource, data url.Values) (*http.Request, error) {
	u, _ := url.Parse(dsInfo.Url)
	u.Path = path.Join(u.Path, "render")

	req, err := http.NewRequest(http.MethodGet, "https://monitoring.googleapis.com/v3/projects/raintank-production/timeSeries?&filter=metric.type%20%3D%20%22compute.googleapis.com%2Finstance%2Fcpu%2Fusage_time%22&aggregation.perSeriesAligner=ALIGN_NONE&interval.startTime=2018-09-04T11%3A14%3A02.383Z&interval.endTime=2018-09-04T11%3A16%3A02.383Z", nil)
	if err != nil {
		glog.Info("Failed to create request", "error", err)
		return nil, fmt.Errorf("Failed to create request. error: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")

	if token, err := pluginproxy.GetAccessTokenFromCache(dsInfo.Id, "stackdriver", "GET"); err != nil {
		logger.Error("Failed to get access token", "error", err)
	} else {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
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
	rMin := regexp.MustCompile("m")
	target = rMinute.ReplaceAllStringFunc(target, func(m string) string {
		return rMin.ReplaceAllString(m, "min")
	})
	rMonth := regexp.MustCompile(`'(\d+)M'`)
	rMon := regexp.MustCompile("M")
	target = rMonth.ReplaceAllStringFunc(target, func(M string) string {
		return rMon.ReplaceAllString(M, "mon")
	})
	return target
}

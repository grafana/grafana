package stackdriver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strings"
	"time"

	"golang.org/x/net/context/ctxhttp"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
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
	result := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}
	var target string

	startTime, err := tsdbQuery.TimeRange.ParseFrom()
	if err != nil {
		return nil, err
	}

	endTime, err := tsdbQuery.TimeRange.ParseTo()
	if err != nil {
		return nil, err
	}

	logger.Info("tsdbQuery", "req.URL.RawQuery", tsdbQuery.TimeRange.From)

	for _, query := range tsdbQuery.Queries {
		if fullTarget, err := query.Model.Get("targetFull").String(); err == nil {
			target = fixIntervalFormat(fullTarget)
		} else {
			target = fixIntervalFormat(query.Model.Get("target").MustString())
		}

		if setting.Env == setting.DEV {
			glog.Debug("Stackdriver request", "params")
		}

		req, err := e.createRequest(ctx, dsInfo)
		metricType := query.Model.Get("metricType").MustString()

		q := req.URL.Query()
		q.Add("interval.startTime", startTime.UTC().Format(time.RFC3339))
		q.Add("interval.endTime", endTime.UTC().Format(time.RFC3339))
		q.Add("aggregation.perSeriesAligner", "ALIGN_NONE")
		q.Add("filter", metricType)
		req.URL.RawQuery = q.Encode()
		logger.Info("tsdbQuery", "req.URL.RawQuery", req.URL.RawQuery)

		if err != nil {
			return nil, err
		}

		httpClient, err := dsInfo.GetHttpClient()
		if err != nil {
			return nil, err
		}

		span, ctx := opentracing.StartSpanFromContext(ctx, "stackdriver query")
		span.SetTag("target", target)
		span.SetTag("from", tsdbQuery.TimeRange.From)
		span.SetTag("until", tsdbQuery.TimeRange.To)
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

		data, err := e.unmarshalResponse(res)
		if err != nil {
			return nil, err
		}

		queryRes, err := e.parseResponse(data, query.RefId)
		result.Results[query.RefId] = queryRes
	}

	return result, nil
}

func (e *StackdriverExecutor) unmarshalResponse(res *http.Response) (StackDriverResponse, error) {
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
		glog.Info("Failed to unmarshal Stackdriver response", "error", err, "status", res.Status, "body", string(body))
		return StackDriverResponse{}, err
	}

	return data, nil
}

func (e *StackdriverExecutor) parseResponse(data StackDriverResponse, queryRefId string) (*tsdb.QueryResult, error) {
	queryRes := tsdb.NewQueryResult()
	queryRes.RefId = queryRefId

	for _, series := range data.TimeSeries {
		points := make([]tsdb.TimePoint, 0)
		for _, point := range series.Points {
			points = append(points, tsdb.NewTimePoint(null.FloatFrom(point.Value.DoubleValue), float64((point.Interval.EndTime).Unix())*1000))
		}
		queryRes.Series = append(queryRes.Series, &tsdb.TimeSeries{
			Name:   series.Metric.Type,
			Points: points,
		})
	}

	return queryRes, nil
}

func (e *StackdriverExecutor) createRequest(ctx context.Context, dsInfo *models.DataSource) (*http.Request, error) {
	u, _ := url.Parse(dsInfo.Url)
	u.Path = path.Join(u.Path, "render")

	req, err := http.NewRequest(http.MethodGet, "https://monitoring.googleapis.com/", nil)
	if err != nil {
		glog.Info("Failed to create request", "error", err)
		return nil, fmt.Errorf("Failed to create request. error: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// find plugin
	plugin, ok := plugins.DataSources[dsInfo.Type]
	if !ok {
		return nil, errors.New("Unable to find datasource plugin Stackdriver")
	}
	proxyPass := fmt.Sprintf("stackdriver%s", "v3/projects/raintank-production/timeSeries")

	var stackdriverRoute *plugins.AppPluginRoute
	for _, route := range plugin.Routes {
		if route.Path == "stackdriver" {
			stackdriverRoute = route
			break
		}
	}

	pluginproxy.ApplyRoute(ctx, req, proxyPass, stackdriverRoute, dsInfo)

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

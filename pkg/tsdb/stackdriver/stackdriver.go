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
	"time"

	"golang.org/x/net/context/ctxhttp"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/opentracing/opentracing-go"
)

var slog log.Logger

// StackdriverExecutor executes queries for the Stackdriver datasource
type StackdriverExecutor struct {
	HTTPClient *http.Client
}

// NewStackdriverExecutor initializes a http client
func NewStackdriverExecutor(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	httpClient, err := dsInfo.GetHttpClient()
	if err != nil {
		return nil, err
	}

	return &StackdriverExecutor{
		HTTPClient: httpClient,
	}, nil
}

func init() {
	slog = log.New("tsdb.stackdriver")
	tsdb.RegisterTsdbQueryEndpoint("stackdriver", NewStackdriverExecutor)
}

// Query takes in the frontend queries, parses them into the Stackdriver query format
// executes the queries against the Stackdriver API and parses the response into
// the time series or table format
func (e *StackdriverExecutor) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}

	queries, err := e.parseQueries(tsdbQuery)
	if err != nil {
		return nil, err
	}

	for _, query := range queries {
		req, err := e.createRequest(ctx, dsInfo)
		if err != nil {
			return nil, err
		}

		req.URL.RawQuery = query.Params.Encode()
		slog.Info("tsdbQuery", "req.URL.RawQuery", req.URL.RawQuery)

		httpClient, err := dsInfo.GetHttpClient()
		if err != nil {
			return nil, err
		}

		span, ctx := opentracing.StartSpanFromContext(ctx, "stackdriver query")
		span.SetTag("target", query.Target)
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

		queryRes, err := e.parseResponse(data, query.RefID)
		if err != nil {
			return nil, err
		}
		result.Results[query.RefID] = queryRes
	}

	return result, nil
}

func (e *StackdriverExecutor) parseQueries(tsdbQuery *tsdb.TsdbQuery) ([]*StackdriverQuery, error) {
	stackdriverQueries := []*StackdriverQuery{}

	startTime, err := tsdbQuery.TimeRange.ParseFrom()
	if err != nil {
		return nil, err
	}

	endTime, err := tsdbQuery.TimeRange.ParseTo()
	if err != nil {
		return nil, err
	}

	for _, query := range tsdbQuery.Queries {
		var target string

		if fullTarget, err := query.Model.Get("targetFull").String(); err == nil {
			target = fixIntervalFormat(fullTarget)
		} else {
			target = fixIntervalFormat(query.Model.Get("target").MustString())
		}

		metricType := query.Model.Get("metricType").MustString()

		params := url.Values{}
		params.Add("interval.startTime", startTime.UTC().Format(time.RFC3339))
		params.Add("interval.endTime", endTime.UTC().Format(time.RFC3339))
		params.Add("aggregation.perSeriesAligner", "ALIGN_NONE")
		params.Add("filter", metricType)

		if setting.Env == setting.DEV {
			slog.Debug("Stackdriver request", "params", params)
		}

		stackdriverQueries = append(stackdriverQueries, &StackdriverQuery{
			Target: target,
			Params: params,
			RefID:  query.RefId,
		})
	}

	return stackdriverQueries, nil
}

func (e *StackdriverExecutor) unmarshalResponse(res *http.Response) (StackDriverResponse, error) {
	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		return StackDriverResponse{}, err
	}

	if res.StatusCode/100 != 2 {
		slog.Info("Request failed", "status", res.Status, "body", string(body))
		return StackDriverResponse{}, fmt.Errorf("Request failed status: %v", res.Status)
	}

	var data StackDriverResponse
	err = json.Unmarshal(body, &data)
	if err != nil {
		slog.Info("Failed to unmarshal Stackdriver response", "error", err, "status", res.Status, "body", string(body))
		return StackDriverResponse{}, err
	}

	return data, nil
}

func (e *StackdriverExecutor) parseResponse(data StackDriverResponse, queryRefID string) (*tsdb.QueryResult, error) {
	queryRes := tsdb.NewQueryResult()
	queryRes.RefId = queryRefID

	for _, series := range data.TimeSeries {
		points := make([]tsdb.TimePoint, 0)
		for _, point := range series.Points {
			points = append(points, tsdb.NewTimePoint(null.FloatFrom(point.Value.DoubleValue), float64((point.Interval.EndTime).Unix())*1000))
		}
		metricName := series.Metric.Type

		for _, value := range series.Metric.Labels {
			metricName += " " + value
		}
		queryRes.Series = append(queryRes.Series, &tsdb.TimeSeries{
			Name:   metricName,
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
		slog.Info("Failed to create request", "error", err)
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

package azuremonitor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"time"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/net/context/ctxhttp"
)

// AzureLogAnalyticsDatasource calls the Azure Log Analytics API's
type AzureLogAnalyticsDatasource struct {
	httpClient *http.Client
	dsInfo     *models.DataSource
}

// AzureLogAnalyticsQuery is the query request that is built from the saved values for
// from the UI
type AzureLogAnalyticsQuery struct {
	RefID  string
	URL    string
	Params url.Values
	Target string
}

// executeTimeSeriesQuery does the following:
// 1. build the AzureMonitor url and querystring for each query
// 2. executes each query by calling the Azure Monitor API
// 3. parses the responses for each query into the timeseries format
func (e *AzureLogAnalyticsDatasource) executeTimeSeriesQuery(ctx context.Context, originalQueries []*tsdb.Query, timeRange *tsdb.TimeRange) (*tsdb.Response, error) {
	result := &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{},
	}

	queries, err := e.buildQueries(originalQueries, timeRange)
	if err != nil {
		return nil, err
	}

	for _, query := range queries {
		queryRes, resp, err := e.executeQuery(ctx, query, originalQueries, timeRange)
		if err != nil {
			return nil, err
		}
		azlog.Debug("AzureLogsAnalytics", "Response", resp)

		queryRes.Series, queryRes.Meta, err = e.parseResponse(resp, query)
		if err != nil {
			queryRes.Error = err
		}
		result.Results[query.RefID] = queryRes
	}

	return result, nil
}

func (e *AzureLogAnalyticsDatasource) buildQueries(queries []*tsdb.Query, timeRange *tsdb.TimeRange) ([]*AzureLogAnalyticsQuery, error) {
	azureLogAnalyticsQueries := []*AzureLogAnalyticsQuery{}

	for _, query := range queries {
		azureLogAnalyticsTarget := query.Model.Get("azureLogAnalytics").MustMap()
		azlog.Debug("AzureLogAnalytics", "target", azureLogAnalyticsTarget)

		urlComponents := map[string]string{}
		urlComponents["subscription"] = fmt.Sprintf("%v", query.Model.Get("subscription").MustString())
		urlComponents["workspace"] = fmt.Sprintf("%v", azureLogAnalyticsTarget["workspace"])
		apiURL := fmt.Sprintf("%s/query", urlComponents["workspace"])

		params := url.Values{}
		rawQuery, err := KqlInterpolate(query, timeRange, fmt.Sprintf("%v", azureLogAnalyticsTarget["query"]), "TimeGenerated")
		if err != nil {
			return nil, err
		}
		params.Add("query", rawQuery)

		azureLogAnalyticsQueries = append(azureLogAnalyticsQueries, &AzureLogAnalyticsQuery{
			RefID:  query.RefId,
			URL:    apiURL,
			Params: params,
			Target: params.Encode(),
		})
	}

	return azureLogAnalyticsQueries, nil
}

func (e *AzureLogAnalyticsDatasource) executeQuery(ctx context.Context, query *AzureLogAnalyticsQuery, queries []*tsdb.Query, timeRange *tsdb.TimeRange) (*tsdb.QueryResult, AzureLogAnalyticsResponse, error) {
	queryResult := &tsdb.QueryResult{Meta: simplejson.New(), RefId: query.RefID}

	req, err := e.createRequest(ctx, e.dsInfo)
	if err != nil {
		queryResult.Error = err
		return queryResult, AzureLogAnalyticsResponse{}, nil
	}

	req.URL.Path = path.Join(req.URL.Path, query.URL)
	req.URL.RawQuery = query.Params.Encode()

	span, ctx := opentracing.StartSpanFromContext(ctx, "azure log analytics query")
	span.SetTag("target", query.Target)
	span.SetTag("from", timeRange.From)
	span.SetTag("until", timeRange.To)
	span.SetTag("datasource_id", e.dsInfo.Id)
	span.SetTag("org_id", e.dsInfo.OrgId)

	defer span.Finish()

	if err := opentracing.GlobalTracer().Inject(
		span.Context(),
		opentracing.HTTPHeaders,
		opentracing.HTTPHeadersCarrier(req.Header)); err != nil {
		queryResult.Error = err
		return queryResult, AzureLogAnalyticsResponse{}, nil
	}

	azlog.Debug("AzureLogAnalytics", "Request ApiURL", req.URL.String())
	res, err := ctxhttp.Do(ctx, e.httpClient, req)
	if err != nil {
		queryResult.Error = err
		return queryResult, AzureLogAnalyticsResponse{}, nil
	}

	data, err := e.unmarshalResponse(res)
	if err != nil {
		queryResult.Error = err
		return queryResult, AzureLogAnalyticsResponse{}, nil
	}

	return queryResult, data, nil
}

func (e *AzureLogAnalyticsDatasource) createRequest(ctx context.Context, dsInfo *models.DataSource) (*http.Request, error) {
	// find plugin
	plugin, ok := plugins.DataSources[dsInfo.Type]
	if !ok {
		return nil, errors.New("Unable to find datasource plugin Azure Monitor")
	}

	var logAnalyticsRoute *plugins.AppPluginRoute
	for _, route := range plugin.Routes {
		if route.Path == "loganalyticsazure" {
			logAnalyticsRoute = route
			break
		}
	}

	u, _ := url.Parse(dsInfo.Url)
	u.Path = path.Join(u.Path, "render")

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		azlog.Error("Failed to create request", "error", err)
		return nil, fmt.Errorf("Failed to create request. error: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))

	pluginproxy.ApplyRoute(ctx, req, "loganalyticsazure", logAnalyticsRoute, dsInfo)

	return req, nil
}

func (e *AzureLogAnalyticsDatasource) unmarshalResponse(res *http.Response) (AzureLogAnalyticsResponse, error) {
	body, err := ioutil.ReadAll(res.Body)
	azlog.Info("test", "body", string(body))

	defer res.Body.Close()
	if err != nil {
		return AzureLogAnalyticsResponse{}, err
	}

	if res.StatusCode/100 != 2 {
		azlog.Error("Request failed", "status", res.Status, "body", string(body))
		return AzureLogAnalyticsResponse{}, fmt.Errorf(string(body))
	}

	var data AzureLogAnalyticsResponse
	err = json.Unmarshal(body, &data)
	if err != nil {
		azlog.Error("Failed to unmarshal Azure Log Analytics response", "error", err, "status", res.Status, "body", string(body))
		return AzureLogAnalyticsResponse{}, err
	}

	return data, nil
}

func (e *AzureLogAnalyticsDatasource) parseResponse(data AzureLogAnalyticsResponse, query *AzureLogAnalyticsQuery) (tsdb.TimeSeriesSlice, *simplejson.Json, error) {
	type Metadata struct {
		Columns []string `json:"columns"`
	}

	meta := Metadata{}

	for _, t := range data.Tables {
		if t.Name == "PrimaryResult" {
			timeIndex, metricIndex, valueIndex := -1, -1, -1
			meta.Columns = make([]string, 0)
			for i, v := range t.Columns {
				meta.Columns = append(meta.Columns, v.Name)

				if timeIndex == -1 && v.Type == "datetime" {
					timeIndex = i
				}

				if metricIndex == -1 && v.Type == "string" {
					metricIndex = i
				}

				if valueIndex == -1 && (v.Type == "int" || v.Type == "long" || v.Type == "real" || v.Type == "double") {
					valueIndex = i
				}
			}

			if timeIndex == -1 {
				azlog.Info("No time column specified. Returning existing columns, no data")
				return nil, simplejson.NewFromAny(meta), nil
			}

			if valueIndex == -1 {
				azlog.Info("No value column specified. Returning existing columns, no data")
				return nil, simplejson.NewFromAny(meta), nil
			}

			slice := tsdb.TimeSeriesSlice{}
			series := &tsdb.TimeSeries{}
			points := make(tsdb.TimeSeriesPoints, 0)

			for _, r := range t.Rows {
				timeStr, ok := r[timeIndex].(string)
				if !ok {
					return nil, simplejson.NewFromAny(meta), errors.New("invalid time value")
				}
				timeValue, err := time.Parse(time.RFC3339Nano, timeStr)
				if err != nil {
					return nil, simplejson.NewFromAny(meta), err
				}

				var value float64
				if value, err = getFloat(r[valueIndex]); err != nil {
					return nil, simplejson.NewFromAny(meta), err
				}

				points = append(points, tsdb.NewTimePoint(null.FloatFrom(value), float64(timeValue.Unix()*1000)))
			}
			series.Points = points
			slice = append(slice, series)

			return slice, simplejson.NewFromAny(meta), nil
		}
	}

	return nil, nil, nil
}

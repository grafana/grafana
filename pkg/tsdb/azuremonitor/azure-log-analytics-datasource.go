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
	RefID        string
	ResultFormat string
	URL          string
	Params       url.Values
	Target       string
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
		queryRes, err := e.executeQuery(ctx, query, originalQueries, timeRange)
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

		resultFormat := fmt.Sprintf("%v", azureLogAnalyticsTarget["resultFormat"])
		if resultFormat == "" {
			resultFormat = "time_series"
		}

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
			RefID:        query.RefId,
			ResultFormat: resultFormat,
			URL:          apiURL,
			Params:       params,
			Target:       params.Encode(),
		})
	}

	return azureLogAnalyticsQueries, nil
}

func (e *AzureLogAnalyticsDatasource) executeQuery(ctx context.Context, query *AzureLogAnalyticsQuery, queries []*tsdb.Query, timeRange *tsdb.TimeRange) (*tsdb.QueryResult, error) {
	queryResult := &tsdb.QueryResult{Meta: simplejson.New(), RefId: query.RefID}

	req, err := e.createRequest(ctx, e.dsInfo)
	if err != nil {
		queryResult.Error = err
		return queryResult, nil
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
		return queryResult, nil
	}

	azlog.Debug("AzureLogAnalytics", "Request ApiURL", req.URL.String())
	res, err := ctxhttp.Do(ctx, e.httpClient, req)
	if err != nil {
		queryResult.Error = err
		return queryResult, nil
	}

	data, err := e.unmarshalResponse(res)
	if err != nil {
		queryResult.Error = err
		return queryResult, nil
	}

	azlog.Debug("AzureLogsAnalytics", "Response", queryResult)

	if query.ResultFormat == "table" {
		queryResult.Tables, queryResult.Meta, err = e.parseToTables(data, query.Params.Get("query"))
	} else {
		queryResult.Series, queryResult.Meta, err = e.parseToTimeSeries(data, query.Params.Get("query"))
		if err != nil {
			return nil, err
		}
	}

	return queryResult, nil
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

func (e *AzureLogAnalyticsDatasource) parseToTables(data AzureLogAnalyticsResponse, query string) ([]*tsdb.Table, *simplejson.Json, error) {
	meta := metadata{
		Query: query,
	}

	tables := make([]*tsdb.Table, 0)
	for _, t := range data.Tables {
		if t.Name == "PrimaryResult" {
			table := tsdb.Table{
				Columns: make([]tsdb.TableColumn, 0),
				Rows:    make([]tsdb.RowValues, 0),
			}

			meta.Columns = make([]column, 0)
			for _, v := range t.Columns {
				meta.Columns = append(meta.Columns, column{Name: v.Name, Type: v.Type})
				table.Columns = append(table.Columns, tsdb.TableColumn{Text: v.Name})
			}

			for _, r := range t.Rows {
				values := make([]interface{}, len(table.Columns))
				for i := 0; i < len(table.Columns); i++ {
					values[i] = r[i]
				}
				table.Rows = append(table.Rows, values)
			}
			tables = append(tables, &table)
			return tables, simplejson.NewFromAny(meta), nil
		}
	}

	return nil, nil, errors.New("no data as no PrimaryResult table was returned in the response")
}

func (e *AzureLogAnalyticsDatasource) parseToTimeSeries(data AzureLogAnalyticsResponse, query string) (tsdb.TimeSeriesSlice, *simplejson.Json, error) {
	meta := metadata{
		Query: query,
	}

	for _, t := range data.Tables {
		if t.Name == "PrimaryResult" {
			timeIndex, metricIndex, valueIndex := -1, -1, -1
			meta.Columns = make([]column, 0)
			for i, v := range t.Columns {
				meta.Columns = append(meta.Columns, column{Name: v.Name, Type: v.Type})

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
			buckets := map[string]*tsdb.TimeSeriesPoints{}

			getSeriesBucket := func(metricName string) *tsdb.TimeSeriesPoints {
				if points, ok := buckets[metricName]; ok {
					return points
				}

				series := tsdb.NewTimeSeries(metricName, []tsdb.TimePoint{})
				slice = append(slice, series)
				buckets[metricName] = &series.Points

				return &series.Points
			}

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

				var metricName string
				if metricIndex == -1 {
					metricName = t.Columns[valueIndex].Name
				} else {
					metricName, ok = r[metricIndex].(string)
					if !ok {
						return nil, simplejson.NewFromAny(meta), err
					}
				}

				points := getSeriesBucket(metricName)
				*points = append(*points, tsdb.NewTimePoint(null.FloatFrom(value), float64(timeValue.Unix()*1000)))
			}

			return slice, simplejson.NewFromAny(meta), nil
		}
	}

	return nil, nil, errors.New("no data as no PrimaryResult table was returned in the response")
}

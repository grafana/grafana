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
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/net/context/ctxhttp"
)

var (
	azlog log.Logger
)

// AzureMonitorExecutor executes queries for the Azure Monitor datasource - all four services
type AzureMonitorExecutor struct {
	httpClient *http.Client
	dsInfo     *models.DataSource
}

// NewAzureMonitorExecutor initializes a http client
func NewAzureMonitorExecutor(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	httpClient, err := dsInfo.GetHttpClient()
	if err != nil {
		return nil, err
	}

	return &AzureMonitorExecutor{
		httpClient: httpClient,
		dsInfo:     dsInfo,
	}, nil
}

func init() {
	azlog = log.New("tsdb.azuremonitor")
	tsdb.RegisterTsdbQueryEndpoint("grafana-azure-monitor-datasource", NewAzureMonitorExecutor)
}

// Query takes in the frontend queries, parses them into the query format
// expected by chosen Azure Monitor service (Azure Monitor, App Insights etc.)
// executes the queries against the API and parses the response into
// the right format
func (e *AzureMonitorExecutor) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	var result *tsdb.Response
	var err error
	queryType := tsdbQuery.Queries[0].Model.Get("queryType").MustString("")

	switch queryType {
	case "Azure Monitor":
		fallthrough
	default:
		result, err = e.executeTimeSeriesQuery(ctx, tsdbQuery)
	}

	return result, err
}

func (e *AzureMonitorExecutor) executeTimeSeriesQuery(ctx context.Context, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}

	queries, err := e.buildQueries(tsdbQuery)
	if err != nil {
		return nil, err
	}

	for _, query := range queries {
		queryRes, resp, err := e.executeQuery(ctx, query, tsdbQuery)
		if err != nil {
			return nil, err
		}
		err = e.parseResponse(queryRes, resp, query)
		if err != nil {
			queryRes.Error = err
		}
		result.Results[query.RefID] = queryRes
	}

	return result, nil
}

func (e *AzureMonitorExecutor) buildQueries(tsdbQuery *tsdb.TsdbQuery) ([]*AzureMonitorQuery, error) {
	azureMonitorQueries := []*AzureMonitorQuery{}
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

		azureMonitorTarget := query.Model.Get("azureMonitor").MustMap()
		azlog.Debug("AzureMonitor", "target", azureMonitorTarget)

		urlComponents := make(map[string]string)
		urlComponents["resourceGroup"] = fmt.Sprintf("%v", azureMonitorTarget["resourceGroup"])
		urlComponents["metricDefinition"] = fmt.Sprintf("%v", azureMonitorTarget["metricDefinition"])
		urlComponents["resourceName"] = fmt.Sprintf("%v", azureMonitorTarget["resourceName"])

		ub := URLBuilder{
			ResourceGroup:    urlComponents["resourceGroup"],
			MetricDefinition: urlComponents["metricDefinition"],
			ResourceName:     urlComponents["resourceName"],
		}
		azureURL := ub.Build()

		alias := fmt.Sprintf("%v", azureMonitorTarget["alias"])

		params := url.Values{}
		params.Add("api-version", "2018-01-01")
		params.Add("timespan", fmt.Sprintf("%v/%v", startTime.UTC().Format(time.RFC3339), endTime.UTC().Format(time.RFC3339)))
		params.Add("interval", fmt.Sprintf("%v", azureMonitorTarget["timeGrain"]))
		params.Add("aggregation", fmt.Sprintf("%v", azureMonitorTarget["aggregation"]))
		params.Add("metricnames", fmt.Sprintf("%v", azureMonitorTarget["metricName"]))

		dimension := fmt.Sprintf("%v", azureMonitorTarget["dimension"])
		dimensionFilter := strings.TrimSpace(fmt.Sprintf("%v", azureMonitorTarget["dimensionFilter"]))
		if azureMonitorTarget["dimension"] != nil && azureMonitorTarget["dimensionFilter"] != nil && dimensionFilter != "" {
			params.Add("$filter", fmt.Sprintf("%s eq '%s'", dimension, dimensionFilter))
		}

		target = params.Encode()

		if setting.Env == setting.DEV {
			azlog.Debug("Azuremonitor request", "params", params)
		}

		azureMonitorQueries = append(azureMonitorQueries, &AzureMonitorQuery{
			URL:           azureURL,
			UrlComponents: urlComponents,
			Target:        target,
			Params:        params,
			RefID:         query.RefId,
			Alias:         alias,
		})
	}

	return azureMonitorQueries, nil
}

func (e *AzureMonitorExecutor) executeQuery(ctx context.Context, query *AzureMonitorQuery, tsdbQuery *tsdb.TsdbQuery) (*tsdb.QueryResult, AzureMonitorResponse, error) {
	queryResult := &tsdb.QueryResult{Meta: simplejson.New(), RefId: query.RefID}

	req, err := e.createRequest(ctx, e.dsInfo)
	if err != nil {
		queryResult.Error = err
		return queryResult, AzureMonitorResponse{}, nil
	}

	req.URL.Path = path.Join(req.URL.Path, query.URL)
	req.URL.RawQuery = query.Params.Encode()
	queryResult.Meta.Set("rawQuery", req.URL.RawQuery)

	span, ctx := opentracing.StartSpanFromContext(ctx, "azuremonitor query")
	span.SetTag("target", query.Target)
	span.SetTag("from", tsdbQuery.TimeRange.From)
	span.SetTag("until", tsdbQuery.TimeRange.To)
	span.SetTag("datasource_id", e.dsInfo.Id)
	span.SetTag("org_id", e.dsInfo.OrgId)

	defer span.Finish()

	opentracing.GlobalTracer().Inject(
		span.Context(),
		opentracing.HTTPHeaders,
		opentracing.HTTPHeadersCarrier(req.Header))

	azlog.Debug("AzureMonitor", "Request URL", req.URL.String())
	res, err := ctxhttp.Do(ctx, e.httpClient, req)
	if err != nil {
		queryResult.Error = err
		return queryResult, AzureMonitorResponse{}, nil
	}

	data, err := e.unmarshalResponse(res)
	if err != nil {
		queryResult.Error = err
		return queryResult, AzureMonitorResponse{}, nil
	}

	return queryResult, data, nil
}

func (e *AzureMonitorExecutor) createRequest(ctx context.Context, dsInfo *models.DataSource) (*http.Request, error) {
	// find plugin
	plugin, ok := plugins.DataSources[dsInfo.Type]
	if !ok {
		return nil, errors.New("Unable to find datasource plugin Azure Monitor")
	}

	var azureMonitorRoute *plugins.AppPluginRoute
	for _, route := range plugin.Routes {
		if route.Path == "azuremonitor" {
			azureMonitorRoute = route
			break
		}
	}

	cloudName := dsInfo.JsonData.Get("cloudName").MustString("azuremonitor")
	subscriptionID := dsInfo.JsonData.Get("subscriptionId").MustString()
	proxyPass := fmt.Sprintf("%s/subscriptions/%s", cloudName, subscriptionID)

	u, _ := url.Parse(dsInfo.Url)
	u.Path = path.Join(u.Path, "render")

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		azlog.Error("Failed to create request", "error", err)
		return nil, fmt.Errorf("Failed to create request. error: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))

	pluginproxy.ApplyRoute(ctx, req, proxyPass, azureMonitorRoute, dsInfo)

	return req, nil
}

func (e *AzureMonitorExecutor) unmarshalResponse(res *http.Response) (AzureMonitorResponse, error) {
	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		return AzureMonitorResponse{}, err
	}

	if res.StatusCode/100 != 2 {
		azlog.Error("Request failed", "status", res.Status, "body", string(body))
		return AzureMonitorResponse{}, fmt.Errorf(string(body))
	}

	var data AzureMonitorResponse
	err = json.Unmarshal(body, &data)
	if err != nil {
		azlog.Error("Failed to unmarshal AzureMonitor response", "error", err, "status", res.Status, "body", string(body))
		return AzureMonitorResponse{}, err
	}

	return data, nil
}

func (e *AzureMonitorExecutor) parseResponse(queryRes *tsdb.QueryResult, data AzureMonitorResponse, query *AzureMonitorQuery) error {
	azlog.Debug("AzureMonitor", "Response", data)

	if len(data.Value) == 0 {
		return nil
	}

	for _, series := range data.Value[0].Timeseries {
		points := make([]tsdb.TimePoint, 0)

		metadataName := ""
		metadataValue := ""
		if len(series.Metadatavalues) > 0 {
			metadataName = series.Metadatavalues[0].Name.LocalizedValue
			metadataValue = series.Metadatavalues[0].Value
		}
		defaultMetricName := formatLegendKey(query.UrlComponents["resourceName"], data.Value[0].Name.LocalizedValue, metadataName, metadataValue)

		for _, point := range series.Data {
			var value float64
			switch query.Params.Get("aggregation") {
			case "Average":
				value = point.Average
			case "Total":
				value = point.Total
			case "Maximum":
				value = point.Maximum
			case "Minimum":
				value = point.Minimum
			case "Count":
				value = point.Count
			default:
				value = point.Count
			}
			points = append(points, tsdb.NewTimePoint(null.FloatFrom(value), float64((point.TimeStamp).Unix())*1000))
		}

		queryRes.Series = append(queryRes.Series, &tsdb.TimeSeries{
			Name:   defaultMetricName,
			Points: points,
		})
	}

	return nil
}

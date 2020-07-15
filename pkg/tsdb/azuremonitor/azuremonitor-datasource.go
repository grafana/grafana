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
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	opentracing "github.com/opentracing/opentracing-go"
	"golang.org/x/net/context/ctxhttp"

	"github.com/grafana/grafana/pkg/tsdb"
)

// AzureMonitorDatasource calls the Azure Monitor API - one of the four API's supported
type AzureMonitorDatasource struct {
	httpClient *http.Client
	dsInfo     *models.DataSource
}

var (
	// 1m, 5m, 15m, 30m, 1h, 6h, 12h, 1d in milliseconds
	defaultAllowedIntervalsMS = []int64{60000, 300000, 900000, 1800000, 3600000, 21600000, 43200000, 86400000}
)

const azureMonitorAPIVersion = "2018-01-01"

// executeTimeSeriesQuery does the following:
// 1. build the AzureMonitor url and querystring for each query
// 2. executes each query by calling the Azure Monitor API
// 3. parses the responses for each query into the timeseries format
func (e *AzureMonitorDatasource) executeTimeSeriesQuery(ctx context.Context, originalQueries []*tsdb.Query, timeRange *tsdb.TimeRange) (*tsdb.Response, error) {
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

		err = e.parseResponse(queryRes, resp, query)
		if err != nil {
			queryRes.Error = err
		}
		result.Results[query.RefID] = queryRes
	}

	return result, nil
}

func (e *AzureMonitorDatasource) buildQueries(queries []*tsdb.Query, timeRange *tsdb.TimeRange) ([]*AzureMonitorQuery, error) {
	azureMonitorQueries := []*AzureMonitorQuery{}
	startTime, err := timeRange.ParseFrom()
	if err != nil {
		return nil, err
	}

	endTime, err := timeRange.ParseTo()
	if err != nil {
		return nil, err
	}

	for _, query := range queries {
		var target string
		queryBytes, err := query.Model.Encode()
		if err != nil {
			return nil, fmt.Errorf("failed to re-encode the Azure Monitor query into JSON: %w", err)
		}

		queryJSONModel := azureMonitorJSONQuery{}
		err = json.Unmarshal(queryBytes, &queryJSONModel)
		if err != nil {
			return nil, fmt.Errorf("failed to decode the Azure Monitor query object from JSON: %w", err)
		}

		azJSONModel := queryJSONModel.AzureMonitor

		urlComponents := map[string]string{}
		urlComponents["subscription"] = queryJSONModel.Subscription
		urlComponents["resourceGroup"] = azJSONModel.ResourceGroup
		urlComponents["metricDefinition"] = azJSONModel.MetricDefinition
		urlComponents["resourceName"] = azJSONModel.ResourceName

		ub := urlBuilder{
			DefaultSubscription: query.DataSource.JsonData.Get("subscriptionId").MustString(),
			Subscription:        queryJSONModel.Subscription,
			ResourceGroup:       queryJSONModel.AzureMonitor.ResourceGroup,
			MetricDefinition:    azJSONModel.MetricDefinition,
			ResourceName:        azJSONModel.ResourceName,
		}
		azureURL := ub.Build()

		alias := azJSONModel.Alias

		timeGrain := azJSONModel.TimeGrain
		timeGrains := azJSONModel.AllowedTimeGrainsMs
		if timeGrain == "auto" {
			timeGrain, err = setAutoTimeGrain(query.IntervalMs, timeGrains)
			if err != nil {
				return nil, err
			}
		}

		params := url.Values{}
		params.Add("api-version", azureMonitorAPIVersion)
		params.Add("timespan", fmt.Sprintf("%v/%v", startTime.UTC().Format(time.RFC3339), endTime.UTC().Format(time.RFC3339)))
		params.Add("interval", timeGrain)
		params.Add("aggregation", azJSONModel.Aggregation)
		params.Add("metricnames", azJSONModel.MetricName) // MetricName or MetricNames ?
		params.Add("metricnamespace", azJSONModel.MetricNamespace)

		// old model
		dimension := strings.TrimSpace(azJSONModel.Dimension)
		dimensionFilter := strings.TrimSpace(azJSONModel.DimensionFilter)

		dimSB := strings.Builder{}

		if dimension != "" && dimensionFilter != "" && dimension != "None" && len(azJSONModel.DimensionsFilters) == 0 {
			dimSB.WriteString(fmt.Sprintf("%s eq '%s'", dimension, dimensionFilter))
		} else {
			for i, filter := range azJSONModel.DimensionsFilters {
				dimSB.WriteString(filter.String())
				if i != len(azJSONModel.DimensionsFilters)-1 {
					dimSB.WriteString(" and ")
				}
			}
		}

		if dimSB.String() != "" {
			params.Add("$filter", dimSB.String())
			params.Add("top", azJSONModel.Top)
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

func (e *AzureMonitorDatasource) executeQuery(ctx context.Context, query *AzureMonitorQuery, queries []*tsdb.Query, timeRange *tsdb.TimeRange) (*tsdb.QueryResult, AzureMonitorResponse, error) {
	queryResult := &tsdb.QueryResult{RefId: query.RefID}

	req, err := e.createRequest(ctx, e.dsInfo)
	if err != nil {
		queryResult.Error = err
		return queryResult, AzureMonitorResponse{}, nil
	}

	req.URL.Path = path.Join(req.URL.Path, query.URL)
	req.URL.RawQuery = query.Params.Encode()

	span, ctx := opentracing.StartSpanFromContext(ctx, "azuremonitor query")
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
		return queryResult, AzureMonitorResponse{}, nil
	}

	azlog.Debug("AzureMonitor", "Request ApiURL", req.URL.String())
	azlog.Debug("AzureMonitor", "Target", query.Target)
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

func (e *AzureMonitorDatasource) createRequest(ctx context.Context, dsInfo *models.DataSource) (*http.Request, error) {
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
	proxyPass := fmt.Sprintf("%s/subscriptions", cloudName)

	u, err := url.Parse(dsInfo.Url)
	if err != nil {
		return nil, err
	}
	u.Path = path.Join(u.Path, "render")

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		azlog.Debug("Failed to create request", "error", err)
		return nil, errutil.Wrap("Failed to create request", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))

	pluginproxy.ApplyRoute(ctx, req, proxyPass, azureMonitorRoute, dsInfo)

	return req, nil
}

func (e *AzureMonitorDatasource) unmarshalResponse(res *http.Response) (AzureMonitorResponse, error) {
	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		return AzureMonitorResponse{}, err
	}

	if res.StatusCode/100 != 2 {
		azlog.Debug("Request failed", "status", res.Status, "body", string(body))
		return AzureMonitorResponse{}, fmt.Errorf("Request failed status: %v", res.Status)
	}

	var data AzureMonitorResponse
	err = json.Unmarshal(body, &data)
	if err != nil {
		azlog.Debug("Failed to unmarshal AzureMonitor response", "error", err, "status", res.Status, "body", string(body))
		return AzureMonitorResponse{}, err
	}

	return data, nil
}

func (e *AzureMonitorDatasource) parseResponse(queryRes *tsdb.QueryResult, amr AzureMonitorResponse, query *AzureMonitorQuery) error {
	if len(amr.Value) == 0 {
		return nil
	}

	frames := data.Frames{}
	for _, series := range amr.Value[0].Timeseries {
		labels := data.Labels{}
		for _, md := range series.Metadatavalues {
			labels[md.Name.LocalizedValue] = md.Value
		}

		frame := data.NewFrameOfFieldTypes("", len(series.Data), data.FieldTypeTime, data.FieldTypeFloat64)
		frame.RefID = query.RefID
		dataField := frame.Fields[1]
		dataField.Name = amr.Value[0].Name.LocalizedValue
		dataField.Labels = labels
		dataField.SetConfig(&data.FieldConfig{
			Unit: amr.Value[0].Unit,
		})
		if query.Alias != "" {
			dataField.Config.DisplayName = formatAzureMonitorLegendKey(query.Alias, query.UrlComponents["resourceName"],
				amr.Value[0].Name.LocalizedValue, "", "", amr.Namespace, amr.Value[0].ID, labels)
		}

		requestedAgg := query.Params.Get("aggregation")

		for i, point := range series.Data {
			var value float64
			switch requestedAgg {
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

			frame.SetRow(i, point.TimeStamp, value)
		}

		frames = append(frames, frame)
	}

	queryRes.Dataframes = tsdb.NewDecodedDataFrames(frames)

	return nil
}

// formatAzureMonitorLegendKey builds the legend key or timeseries name
// Alias patterns like {{resourcename}} are replaced with the appropriate data values.
func formatAzureMonitorLegendKey(alias string, resourceName string, metricName string, metadataName string, metadataValue string, namespace string, seriesID string, labels data.Labels) string {
	startIndex := strings.Index(seriesID, "/resourceGroups/") + 16
	endIndex := strings.Index(seriesID, "/providers")
	resourceGroup := seriesID[startIndex:endIndex]

	// Could be a collision problem if there were two keys that varied only in case, but I don't think that would happen in azure.
	lowerLabels := data.Labels{}
	for k, v := range labels {
		lowerLabels[strings.ToLower(k)] = v
	}
	keys := make([]string, 0, len(labels))
	for k := range lowerLabels {
		keys = append(keys, k)
	}
	keys = sort.StringSlice(keys)

	result := legendKeyFormat.ReplaceAllFunc([]byte(alias), func(in []byte) []byte {
		metaPartName := strings.Replace(string(in), "{{", "", 1)
		metaPartName = strings.Replace(metaPartName, "}}", "", 1)
		metaPartName = strings.ToLower(strings.TrimSpace(metaPartName))

		if metaPartName == "resourcegroup" {
			return []byte(resourceGroup)
		}

		if metaPartName == "namespace" {
			return []byte(namespace)
		}

		if metaPartName == "resourcename" {
			return []byte(resourceName)
		}

		if metaPartName == "metric" {
			return []byte(metricName)
		}

		if metaPartName == "dimensionname" {
			return []byte(keys[0])
		}

		if metaPartName == "dimensionvalue" {
			return []byte(lowerLabels[keys[0]])
		}

		if v, ok := lowerLabels[metaPartName]; ok {
			return []byte(v)
		}
		return in
	})

	return string(result)
}

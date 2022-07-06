package metrics

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azlog"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/resourcegraph"
	azTime "github.com/grafana/grafana/pkg/tsdb/azuremonitor/time"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

// AzureMonitorDatasource calls the Azure Monitor API - one of the four API's supported
type AzureMonitorDatasource struct {
	Proxy types.ServiceProxy
}

var (
	// Used to convert the aggregation value to the Azure enum for deep linking
	aggregationTypeMap   = map[string]int{"None": 0, "Total": 1, "Minimum": 2, "Maximum": 3, "Average": 4, "Count": 7}
	resourceNameLandmark = regexp.MustCompile(`(?i)(/(?P<resourceName>[\w-\.]+)/providers/Microsoft\.Insights/metrics)`)
)

const AzureMonitorAPIVersion = "2018-01-01"

func (e *AzureMonitorDatasource) ResourceRequest(rw http.ResponseWriter, req *http.Request, cli *http.Client) {
	e.Proxy.Do(rw, req, cli)
}

// executeTimeSeriesQuery does the following:
// 1. build the AzureMonitor url and querystring for each query
// 2. executes each query by calling the Azure Monitor API
// 3. parses the responses for each query into data frames
func (e *AzureMonitorDatasource) ExecuteTimeSeriesQuery(ctx context.Context, originalQueries []backend.DataQuery, dsInfo types.DatasourceInfo, client *http.Client,
	url string, tracer tracing.Tracer) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()

	queries, err := e.buildQueries(originalQueries, dsInfo)
	if err != nil {
		return nil, err
	}

	for _, query := range queries {
		result.Responses[query.RefID] = e.executeQuery(ctx, query, dsInfo, client, url, tracer)
	}

	return result, nil
}

func (e *AzureMonitorDatasource) buildQueries(queries []backend.DataQuery, dsInfo types.DatasourceInfo) ([]*types.AzureMonitorQuery, error) {
	azureMonitorQueries := []*types.AzureMonitorQuery{}

	for _, query := range queries {
		var target string
		queryJSONModel := types.AzureMonitorJSONQuery{}
		err := json.Unmarshal(query.JSON, &queryJSONModel)
		if err != nil {
			return nil, fmt.Errorf("failed to decode the Azure Monitor query object from JSON: %w", err)
		}

		azJSONModel := queryJSONModel.AzureMonitor

		ub := urlBuilder{
			ResourceURI: azJSONModel.ResourceURI,
			// Legacy, used to reconstruct resource URI if it's not present
			DefaultSubscription: dsInfo.Settings.SubscriptionId,
			Subscription:        queryJSONModel.Subscription,
			ResourceGroup:       azJSONModel.ResourceGroup,
			MetricDefinition:    azJSONModel.MetricDefinition,
			ResourceName:        azJSONModel.ResourceName,
		}

		azJSONModel.DimensionFilters = MigrateDimensionFilters(azJSONModel.DimensionFilters)
		azureURL := ub.BuildMetricsURL()

		resourceName := azJSONModel.ResourceName
		if resourceName == "" {
			resourceName = extractResourceNameFromMetricsURL(azureURL)
		}

		urlComponents := map[string]string{}
		urlComponents["resourceURI"] = azJSONModel.ResourceURI
		// Legacy fields used for constructing a deep link to display the query in Azure Portal.
		urlComponents["subscription"] = queryJSONModel.Subscription
		urlComponents["resourceGroup"] = azJSONModel.ResourceGroup
		urlComponents["metricDefinition"] = azJSONModel.MetricDefinition
		urlComponents["resourceName"] = resourceName

		alias := azJSONModel.Alias

		timeGrain := azJSONModel.TimeGrain
		timeGrains := azJSONModel.AllowedTimeGrainsMs

		if timeGrain == "auto" {
			timeGrain, err = azTime.SetAutoTimeGrain(query.Interval.Milliseconds(), timeGrains)
			if err != nil {
				return nil, err
			}
		}

		params := url.Values{}
		params.Add("api-version", AzureMonitorAPIVersion)
		params.Add("timespan", fmt.Sprintf("%v/%v", query.TimeRange.From.UTC().Format(time.RFC3339), query.TimeRange.To.UTC().Format(time.RFC3339)))
		params.Add("interval", timeGrain)
		params.Add("aggregation", azJSONModel.Aggregation)
		params.Add("metricnames", azJSONModel.MetricName) // MetricName or MetricNames ?
		params.Add("metricnamespace", azJSONModel.MetricNamespace)

		// old model
		dimension := strings.TrimSpace(azJSONModel.Dimension)
		dimensionFilter := strings.TrimSpace(azJSONModel.DimensionFilter)

		dimSB := strings.Builder{}

		if dimension != "" && dimensionFilter != "" && dimension != "None" && len(azJSONModel.DimensionFilters) == 0 {
			dimSB.WriteString(fmt.Sprintf("%s eq '%s'", dimension, dimensionFilter))
		} else {
			for i, filter := range azJSONModel.DimensionFilters {
				if len(filter.Filters) == 0 {
					dimSB.WriteString(fmt.Sprintf("%s eq '*'", filter.Dimension))
				} else {
					dimSB.WriteString(filter.ConstructFiltersString())
				}
				if i != len(azJSONModel.DimensionFilters)-1 {
					dimSB.WriteString(" and ")
				}
			}
		}

		if dimSB.String() != "" {
			params.Add("$filter", dimSB.String())
			if azJSONModel.Top != "" {
				params.Add("top", azJSONModel.Top)
			}
		}

		target = params.Encode()

		if setting.Env == setting.Dev {
			azlog.Debug("Azuremonitor request", "params", params)
		}

		azureMonitorQueries = append(azureMonitorQueries, &types.AzureMonitorQuery{
			URL:           azureURL,
			UrlComponents: urlComponents,
			Target:        target,
			Params:        params,
			RefID:         query.RefID,
			Alias:         alias,
			TimeRange:     query.TimeRange,
		})
	}

	return azureMonitorQueries, nil
}

func (e *AzureMonitorDatasource) executeQuery(ctx context.Context, query *types.AzureMonitorQuery, dsInfo types.DatasourceInfo, cli *http.Client,
	url string, tracer tracing.Tracer) backend.DataResponse {
	dataResponse := backend.DataResponse{}

	req, err := e.createRequest(ctx, dsInfo, url)
	if err != nil {
		dataResponse.Error = err
		return dataResponse
	}

	req.URL.Path = path.Join(req.URL.Path, query.URL)
	req.URL.RawQuery = query.Params.Encode()

	ctx, span := tracer.Start(ctx, "azuremonitor query")
	span.SetAttributes("target", query.Target, attribute.Key("target").String(query.Target))
	span.SetAttributes("from", query.TimeRange.From.UnixNano()/int64(time.Millisecond), attribute.Key("from").Int64(query.TimeRange.From.UnixNano()/int64(time.Millisecond)))
	span.SetAttributes("until", query.TimeRange.To.UnixNano()/int64(time.Millisecond), attribute.Key("until").Int64(query.TimeRange.To.UnixNano()/int64(time.Millisecond)))
	span.SetAttributes("datasource_id", dsInfo.DatasourceID, attribute.Key("datasource_id").Int64(dsInfo.DatasourceID))
	span.SetAttributes("org_id", dsInfo.OrgID, attribute.Key("org_id").Int64(dsInfo.OrgID))

	defer span.End()
	tracer.Inject(ctx, req.Header, span)

	azlog.Debug("AzureMonitor", "Request ApiURL", req.URL.String())
	azlog.Debug("AzureMonitor", "Target", query.Target)
	res, err := cli.Do(req)
	if err != nil {
		dataResponse.Error = err
		return dataResponse
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			azlog.Warn("Failed to close response body", "err", err)
		}
	}()

	data, err := e.unmarshalResponse(res)
	if err != nil {
		dataResponse.Error = err
		return dataResponse
	}

	azurePortalUrl, err := resourcegraph.GetAzurePortalUrl(dsInfo.Cloud)
	if err != nil {
		dataResponse.Error = err
		return dataResponse
	}

	dataResponse.Frames, err = e.parseResponse(data, query, azurePortalUrl)
	if err != nil {
		dataResponse.Error = err
		return dataResponse
	}

	return dataResponse
}

func (e *AzureMonitorDatasource) createRequest(ctx context.Context, dsInfo types.DatasourceInfo, url string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		azlog.Debug("Failed to create request", "error", err)
		return nil, fmt.Errorf("%v: %w", "Failed to create request", err)
	}
	req.Header.Set("Content-Type", "application/json")

	return req, nil
}

func (e *AzureMonitorDatasource) unmarshalResponse(res *http.Response) (types.AzureMonitorResponse, error) {
	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return types.AzureMonitorResponse{}, err
	}

	if res.StatusCode/100 != 2 {
		azlog.Debug("Request failed", "status", res.Status, "body", string(body))
		return types.AzureMonitorResponse{}, fmt.Errorf("request failed, status: %s", res.Status)
	}

	var data types.AzureMonitorResponse
	err = json.Unmarshal(body, &data)
	if err != nil {
		azlog.Debug("Failed to unmarshal AzureMonitor response", "error", err, "status", res.Status, "body", string(body))
		return types.AzureMonitorResponse{}, err
	}

	return data, nil
}

func (e *AzureMonitorDatasource) parseResponse(amr types.AzureMonitorResponse, query *types.AzureMonitorQuery, azurePortalUrl string) (data.Frames, error) {
	if len(amr.Value) == 0 {
		return nil, nil
	}

	queryUrl, err := getQueryUrl(query, azurePortalUrl)
	if err != nil {
		return nil, err
	}

	frames := data.Frames{}
	for _, series := range amr.Value[0].Timeseries {
		labels := data.Labels{}
		for _, md := range series.Metadatavalues {
			labels[md.Name.LocalizedValue] = md.Value
		}

		frame := data.NewFrameOfFieldTypes("", len(series.Data), data.FieldTypeTime, data.FieldTypeNullableFloat64)
		frame.RefID = query.RefID
		timeField := frame.Fields[0]
		timeField.Name = data.TimeSeriesTimeFieldName
		dataField := frame.Fields[1]
		dataField.Name = amr.Value[0].Name.LocalizedValue
		dataField.Labels = labels
		if amr.Value[0].Unit != "Unspecified" {
			dataField.SetConfig(&data.FieldConfig{
				Unit: toGrafanaUnit(amr.Value[0].Unit),
			})
		}
		if query.Alias != "" {
			displayName := formatAzureMonitorLegendKey(query.Alias, query.UrlComponents["resourceName"],
				amr.Value[0].Name.LocalizedValue, "", "", amr.Namespace, amr.Value[0].ID, labels)

			if dataField.Config != nil {
				dataField.Config.DisplayName = displayName
			} else {
				dataField.SetConfig(&data.FieldConfig{
					DisplayName: displayName,
				})
			}
		}

		requestedAgg := query.Params.Get("aggregation")

		for i, point := range series.Data {
			var value *float64
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

		frameWithLink := resourcegraph.AddConfigLinks(*frame, queryUrl)
		frames = append(frames, &frameWithLink)
	}

	return frames, nil
}

// Gets the deep link for the given query
func getQueryUrl(query *types.AzureMonitorQuery, azurePortalUrl string) (string, error) {
	aggregationType := aggregationTypeMap["Average"]
	aggregation := query.Params.Get("aggregation")
	if aggregation != "" {
		if aggType, ok := aggregationTypeMap[aggregation]; ok {
			aggregationType = aggType
		}
	}

	timespan, err := json.Marshal(map[string]interface{}{
		"absolute": struct {
			Start string `json:"startTime"`
			End   string `json:"endTime"`
		}{
			Start: query.TimeRange.From.UTC().Format(time.RFC3339Nano),
			End:   query.TimeRange.To.UTC().Format(time.RFC3339Nano),
		},
	})
	if err != nil {
		return "", err
	}
	escapedTime := url.QueryEscape(string(timespan))

	id := query.UrlComponents["resourceURI"]

	if id == "" {
		ub := urlBuilder{
			Subscription:     query.UrlComponents["subscription"],
			ResourceGroup:    query.UrlComponents["resourceGroup"],
			MetricDefinition: query.UrlComponents["metricDefinition"],
			ResourceName:     query.UrlComponents["resourceName"],
		}
		id = ub.buildResourceURIFromLegacyQuery()
	}

	chartDef, err := json.Marshal(map[string]interface{}{
		"v2charts": []interface{}{
			map[string]interface{}{
				"metrics": []types.MetricChartDefinition{
					{
						ResourceMetadata: map[string]string{
							"id": id,
						},
						Name:            query.Params.Get("metricnames"),
						AggregationType: aggregationType,
						Namespace:       query.Params.Get("metricnamespace"),
						MetricVisualization: types.MetricVisualization{
							DisplayName:         query.Params.Get("metricnames"),
							ResourceDisplayName: query.UrlComponents["resourceName"],
						},
					},
				},
			},
		},
	})
	if err != nil {
		return "", err
	}
	escapedChart := url.QueryEscape(string(chartDef))
	// Azure Portal will timeout if the chart definition includes a space character encoded as '+'.
	// url.QueryEscape encodes spaces as '+'.
	// Note: this will not encode '+' literals as those are already encoded as '%2B' by url.QueryEscape
	escapedChart = strings.ReplaceAll(escapedChart, "+", "%20")

	return fmt.Sprintf("%s/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/%s/ChartDefinition/%s", azurePortalUrl, escapedTime, escapedChart), nil
}

// formatAzureMonitorLegendKey builds the legend key or timeseries name
// Alias patterns like {{resourcename}} are replaced with the appropriate data values.
func formatAzureMonitorLegendKey(alias string, resourceName string, metricName string, metadataName string,
	metadataValue string, namespace string, seriesID string, labels data.Labels) string {
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

	result := types.LegendKeyFormat.ReplaceAllFunc([]byte(alias), func(in []byte) []byte {
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
			if len(keys) == 0 {
				return []byte{}
			}
			return []byte(keys[0])
		}

		if metaPartName == "dimensionvalue" {
			if len(keys) == 0 {
				return []byte{}
			}
			return []byte(lowerLabels[keys[0]])
		}

		if v, ok := lowerLabels[metaPartName]; ok {
			return []byte(v)
		}
		return in
	})

	return string(result)
}

// Map values from:
//   https://docs.microsoft.com/en-us/rest/api/monitor/metrics/list#unit
// to
//   https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/valueFormats/categories.ts#L24
func toGrafanaUnit(unit string) string {
	switch unit {
	case "BitsPerSecond":
		return "bps"
	case "Bytes":
		return "decbytes" // or ICE
	case "BytesPerSecond":
		return "Bps"
	case "Count":
		return "short" // this is used for integers
	case "CountPerSecond":
		return "cps"
	case "Percent":
		return "percent"
	case "MilliSeconds":
		return "ms"
	case "Seconds":
		return "s"
	}
	return unit // this will become a suffix in the display
	// "ByteSeconds", "Cores", "MilliCores", and "NanoCores" all both:
	// 1. Do not have a corresponding unit in Grafana's current list.
	// 2. Do not have the unit listed in any of Azure Monitor's supported metrics anyways.
}

func extractResourceNameFromMetricsURL(url string) string {
	matches := resourceNameLandmark.FindStringSubmatch(url)
	resourceName := ""

	if matches == nil {
		return resourceName
	}

	for i, name := range resourceNameLandmark.SubexpNames() {
		if name == "resourceName" {
			resourceName = matches[i]
		}
	}

	return resourceName
}

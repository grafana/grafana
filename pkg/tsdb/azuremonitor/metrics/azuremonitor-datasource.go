package metrics

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
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

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/loganalytics"
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

const AzureMonitorAPIVersion = "2021-05-01"

func (e *AzureMonitorDatasource) ResourceRequest(rw http.ResponseWriter, req *http.Request, cli *http.Client) {
	e.Proxy.Do(rw, req, cli)
}

// executeTimeSeriesQuery does the following:
// 1. build the AzureMonitor url and querystring for each query
// 2. executes each query by calling the Azure Monitor API
// 3. parses the responses for each query into data frames
func (e *AzureMonitorDatasource) ExecuteTimeSeriesQuery(ctx context.Context, logger log.Logger, originalQueries []backend.DataQuery, dsInfo types.DatasourceInfo, client *http.Client, url string, tracer tracing.Tracer) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()
	ctxLogger := logger.FromContext(ctx)

	queries, err := e.buildQueries(ctxLogger, originalQueries, dsInfo)
	if err != nil {
		return nil, err
	}

	for _, query := range queries {
		result.Responses[query.RefID] = e.executeQuery(ctx, ctxLogger, query, dsInfo, client, url, tracer)
	}

	return result, nil
}

func (e *AzureMonitorDatasource) buildQueries(logger log.Logger, queries []backend.DataQuery, dsInfo types.DatasourceInfo) ([]*types.AzureMonitorQuery, error) {
	azureMonitorQueries := []*types.AzureMonitorQuery{}

	for _, query := range queries {
		var target string
		queryJSONModel := types.AzureMonitorJSONQuery{}
		err := json.Unmarshal(query.JSON, &queryJSONModel)
		if err != nil {
			return nil, fmt.Errorf("failed to decode the Azure Monitor query object from JSON: %w", err)
		}

		azJSONModel := queryJSONModel.AzureMonitor
		// Legacy: If only MetricDefinition is set, use it as namespace
		if azJSONModel.MetricDefinition != "" && azJSONModel.MetricNamespace == "" {
			azJSONModel.MetricNamespace = azJSONModel.MetricDefinition
		}

		azJSONModel.DimensionFilters = MigrateDimensionFilters(azJSONModel.DimensionFilters)

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
		params.Add("metricnames", azJSONModel.MetricName)

		if azJSONModel.CustomNamespace != "" {
			params.Add("metricnamespace", azJSONModel.CustomNamespace)
		} else {
			params.Add("metricnamespace", azJSONModel.MetricNamespace)
		}

		azureURL := BuildSubscriptionMetricsURL(queryJSONModel.Subscription)
		filterInBody := true
		if azJSONModel.Region != "" {
			params.Add("region", azJSONModel.Region)
		}
		resourceIDs := []string{}
		if hasOne, resourceGroup, resourceName := hasOneResource(queryJSONModel); hasOne {
			ub := urlBuilder{
				ResourceURI: azJSONModel.ResourceURI,
				// Alternative, used to reconstruct resource URI if it's not present
				DefaultSubscription: dsInfo.Settings.SubscriptionId,
				Subscription:        queryJSONModel.Subscription,
				ResourceGroup:       resourceGroup,
				MetricNamespace:     azJSONModel.MetricNamespace,
				ResourceName:        resourceName,
			}
			azureURL = ub.BuildMetricsURL()
			// POST requests are only supported at the subscription level
			filterInBody = false
		} else {
			for _, r := range azJSONModel.Resources {
				ub := urlBuilder{
					DefaultSubscription: dsInfo.Settings.SubscriptionId,
					Subscription:        queryJSONModel.Subscription,
					ResourceGroup:       r.ResourceGroup,
					MetricNamespace:     azJSONModel.MetricNamespace,
					ResourceName:        r.ResourceName,
				}
				resourceIDs = append(resourceIDs, fmt.Sprintf("Microsoft.ResourceId eq '%s'", ub.buildResourceURI()))
			}
		}

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

		filterString := strings.Join(resourceIDs, " or ")

		if dimSB.String() != "" {
			if filterString != "" {
				filterString = fmt.Sprintf("(%s) and (%s)", filterString, dimSB.String())
			} else {
				filterString = dimSB.String()
			}
			if azJSONModel.Top != "" {
				params.Add("top", azJSONModel.Top)
			}
		}

		target = params.Encode()

		if setting.Env == setting.Dev {
			logger.Debug("Azuremonitor request", "params", params)
		}

		query := &types.AzureMonitorQuery{
			URL:        azureURL,
			Target:     target,
			Params:     params,
			RefID:      query.RefID,
			Alias:      alias,
			TimeRange:  query.TimeRange,
			Dimensions: azJSONModel.DimensionFilters,
		}
		if filterString != "" {
			if filterInBody {
				query.BodyFilter = filterString
			} else {
				query.Params.Add("$filter", filterString)
			}
		}
		azureMonitorQueries = append(azureMonitorQueries, query)
	}

	return azureMonitorQueries, nil
}

func (e *AzureMonitorDatasource) executeQuery(ctx context.Context, logger log.Logger, query *types.AzureMonitorQuery, dsInfo types.DatasourceInfo, cli *http.Client,
	url string, tracer tracing.Tracer) backend.DataResponse {
	dataResponse := backend.DataResponse{}

	req, err := e.createRequest(ctx, logger, url)
	if err != nil {
		dataResponse.Error = err
		return dataResponse
	}

	req.URL.Path = path.Join(req.URL.Path, query.URL)
	req.URL.RawQuery = query.Params.Encode()
	if query.BodyFilter != "" {
		req.Method = http.MethodPost
		req.Body = io.NopCloser(strings.NewReader(fmt.Sprintf(`{"filter": "%s"}`, query.BodyFilter)))
	}

	ctx, span := tracer.Start(ctx, "azuremonitor query")
	span.SetAttributes("target", query.Target, attribute.Key("target").String(query.Target))
	span.SetAttributes("from", query.TimeRange.From.UnixNano()/int64(time.Millisecond), attribute.Key("from").Int64(query.TimeRange.From.UnixNano()/int64(time.Millisecond)))
	span.SetAttributes("until", query.TimeRange.To.UnixNano()/int64(time.Millisecond), attribute.Key("until").Int64(query.TimeRange.To.UnixNano()/int64(time.Millisecond)))
	span.SetAttributes("datasource_id", dsInfo.DatasourceID, attribute.Key("datasource_id").Int64(dsInfo.DatasourceID))
	span.SetAttributes("org_id", dsInfo.OrgID, attribute.Key("org_id").Int64(dsInfo.OrgID))

	defer span.End()
	tracer.Inject(ctx, req.Header, span)

	logger.Debug("AzureMonitor", "Request ApiURL", req.URL.String())
	logger.Debug("AzureMonitor", "Target", query.Target)
	res, err := cli.Do(req)
	if err != nil {
		dataResponse.Error = err
		return dataResponse
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()

	data, err := e.unmarshalResponse(logger, res)
	if err != nil {
		dataResponse.Error = err
		return dataResponse
	}

	azurePortalUrl, err := loganalytics.GetAzurePortalUrl(dsInfo.Cloud)
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

func (e *AzureMonitorDatasource) createRequest(ctx context.Context, logger log.Logger, url string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		logger.Debug("Failed to create request", "error", err)
		return nil, fmt.Errorf("%v: %w", "Failed to create request", err)
	}
	req.Header.Set("Content-Type", "application/json")

	return req, nil
}

func (e *AzureMonitorDatasource) unmarshalResponse(logger log.Logger, res *http.Response) (types.AzureMonitorResponse, error) {
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return types.AzureMonitorResponse{}, err
	}

	if res.StatusCode/100 != 2 {
		logger.Debug("Request failed", "status", res.Status, "body", string(body))
		return types.AzureMonitorResponse{}, fmt.Errorf("request failed, status: %s, error: %s", res.Status, string(body))
	}

	var data types.AzureMonitorResponse
	err = json.Unmarshal(body, &data)
	if err != nil {
		logger.Debug("Failed to unmarshal AzureMonitor response", "error", err, "status", res.Status, "body", string(body))
		return types.AzureMonitorResponse{}, err
	}

	return data, nil
}

func (e *AzureMonitorDatasource) parseResponse(amr types.AzureMonitorResponse, query *types.AzureMonitorQuery, azurePortalUrl string) (data.Frames, error) {
	if len(amr.Value) == 0 {
		return nil, nil
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
		resourceID, ok := labels["microsoft.resourceid"]
		if !ok {
			resourceID = labels["Microsoft.ResourceId"]
		}
		resourceIDSlice := strings.Split(resourceID, "/")
		resourceName := ""
		if len(resourceIDSlice) > 1 {
			resourceName = resourceIDSlice[len(resourceIDSlice)-1]
		} else {
			// Deprecated: This is for backward compatibility, the URL should contain
			// the resource ID
			resourceName = extractResourceNameFromMetricsURL(query.URL)
			resourceID = extractResourceIDFromMetricsURL(query.URL)
		}
		displayName := ""
		if query.Alias != "" {
			displayName = formatAzureMonitorLegendKey(query.Alias, resourceName,
				amr.Value[0].Name.LocalizedValue, "", "", amr.Namespace, amr.Value[0].ID, labels)
		} else if len(labels) > 0 {
			// If labels are set, it will be used as the legend so we need to set a more user-friendly name
			displayName = amr.Value[0].Name.LocalizedValue
			if resourceName != "" {
				displayName += " " + resourceName
			}
		}
		if displayName != "" {
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

		queryUrl, err := getQueryUrl(query, azurePortalUrl, resourceID, resourceName)
		if err != nil {
			return nil, err
		}

		frameWithLink := loganalytics.AddConfigLinks(*frame, queryUrl)
		frames = append(frames, &frameWithLink)
	}

	return frames, nil
}

// Gets the deep link for the given query
func getQueryUrl(query *types.AzureMonitorQuery, azurePortalUrl, resourceID, resourceName string) (string, error) {
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

	var filters []types.AzureMonitorDimensionFilterBackend
	var grouping map[string]interface{}

	if len(query.Dimensions) > 0 {
		for _, dimension := range query.Dimensions {
			var dimensionInt int
			dimensionFilters := dimension.Filters

			// Only the first dimension determines the splitting shown in the Azure Portal
			if grouping == nil {
				grouping = map[string]interface{}{
					"dimension": dimension.Dimension,
					"sort":      2,
					"top":       10,
				}
			}

			if len(dimension.Filters) == 0 {
				continue
			}

			switch dimension.Operator {
			case "eq":
				dimensionInt = 0
			case "ne":
				dimensionInt = 1
			case "sw":
				dimensionInt = 3
			}

			filter := types.AzureMonitorDimensionFilterBackend{
				Key:      dimension.Dimension,
				Operator: dimensionInt,
				Values:   dimensionFilters,
			}
			filters = append(filters, filter)
		}
	}

	chart := map[string]interface{}{
		"metrics": []types.MetricChartDefinition{
			{
				ResourceMetadata: map[string]string{
					"id": resourceID,
				},
				Name:            query.Params.Get("metricnames"),
				AggregationType: aggregationType,
				Namespace:       query.Params.Get("metricnamespace"),
				MetricVisualization: types.MetricVisualization{
					DisplayName:         query.Params.Get("metricnames"),
					ResourceDisplayName: resourceName,
				},
			},
		},
	}

	if filters != nil {
		chart["filterCollection"] = map[string]interface{}{
			"filters": filters,
		}
	}
	if grouping != nil {
		chart["grouping"] = grouping
	}

	chartDef, err := json.Marshal(map[string]interface{}{
		"v2charts": []interface{}{
			chart,
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
	sort.Strings(keys)

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
//
//	https://docs.microsoft.com/en-us/rest/api/monitor/metrics/list#unit
//
// to
//
//	https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/valueFormats/categories.ts#L24
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

func extractResourceIDFromMetricsURL(url string) string {
	return strings.Split(url, "/providers/microsoft.insights/metrics")[0]
}

func hasOneResource(query types.AzureMonitorJSONQuery) (bool, string, string) {
	azJSONModel := query.AzureMonitor
	if len(azJSONModel.Resources) > 1 {
		return false, "", ""
	}
	if len(azJSONModel.Resources) == 1 {
		return true, azJSONModel.Resources[0].ResourceGroup, azJSONModel.Resources[0].ResourceName
	}
	if azJSONModel.ResourceGroup != "" || azJSONModel.ResourceName != "" {
		// Deprecated, Resources should be used instead
		return true, azJSONModel.ResourceGroup, azJSONModel.ResourceName
	}
	return false, "", ""
}

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
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/loganalytics"
	azTime "github.com/grafana/grafana/pkg/tsdb/azuremonitor/time"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/utils"
)

// AzureMonitorDatasource calls the Azure Monitor API - one of the four API's supported
type AzureMonitorDatasource struct {
	Proxy  types.ServiceProxy
	Logger log.Logger
}

var (
	// Used to convert the aggregation value to the Azure enum for deep linking
	aggregationTypeMap   = map[string]int{"None": 0, "Total": 1, "Minimum": 2, "Maximum": 3, "Average": 4, "Count": 7}
	resourceNameLandmark = regexp.MustCompile(`(?i)(/(?P<resourceName>[\w-\.]+)/providers/Microsoft\.Insights/metrics)`)
)

const AzureMonitorAPIVersion = "2021-05-01"

func (e *AzureMonitorDatasource) ResourceRequest(rw http.ResponseWriter, req *http.Request, cli *http.Client) (http.ResponseWriter, error) {
	return e.Proxy.Do(rw, req, cli)
}

// executeTimeSeriesQuery does the following:
// 1. build the AzureMonitor url and querystring for each query
// 2. executes each query by calling the Azure Monitor API
// 3. parses the responses for each query into data frames
func (e *AzureMonitorDatasource) ExecuteTimeSeriesQuery(ctx context.Context, originalQueries []backend.DataQuery, dsInfo types.DatasourceInfo, client *http.Client, url string, fromAlert bool) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()

	for _, query := range originalQueries {
		azureQuery, err := e.buildQuery(query, dsInfo)
		if err != nil {
			result.Responses[query.RefID] = backend.ErrorResponseWithErrorSource(err)
			continue
		}
		res, err := e.executeQuery(ctx, azureQuery, dsInfo, client, url)
		if err != nil {
			result.Responses[query.RefID] = backend.ErrorResponseWithErrorSource(err)
			continue
		}
		result.Responses[query.RefID] = *res
	}

	return result, nil
}

func (e *AzureMonitorDatasource) buildQuery(query backend.DataQuery, dsInfo types.DatasourceInfo) (*types.AzureMonitorQuery, error) {
	var target string
	queryJSONModel := dataquery.AzureMonitorQuery{}
	err := json.Unmarshal(query.JSON, &queryJSONModel)
	if err != nil {
		return nil, fmt.Errorf("failed to decode the Azure Monitor query object from JSON: %w", err)
	}

	azJSONModel := queryJSONModel.AzureMonitor
	// Legacy: If only MetricDefinition is set, use it as namespace
	if azJSONModel.MetricDefinition != nil && *azJSONModel.MetricDefinition != "" &&
		azJSONModel.MetricNamespace != nil && *azJSONModel.MetricNamespace == "" {
		azJSONModel.MetricNamespace = azJSONModel.MetricDefinition
	}

	azJSONModel.DimensionFilters = MigrateDimensionFilters(azJSONModel.DimensionFilters)

	alias := ""
	if azJSONModel.Alias != nil {
		alias = *azJSONModel.Alias
	}
	azureURL := ""
	if queryJSONModel.Subscription != nil {
		azureURL = BuildSubscriptionMetricsURL(*queryJSONModel.Subscription)
	}
	filterInBody := true
	resourceIDs := []string{}
	resourceMap := map[string]dataquery.AzureMonitorResource{}
	if hasOne, resourceGroup, resourceName := hasOneResource(queryJSONModel); hasOne {
		ub := urlBuilder{
			ResourceURI: azJSONModel.ResourceUri,
			// Alternative, used to reconstruct resource URI if it's not present
			DefaultSubscription: &dsInfo.Settings.SubscriptionId,
			Subscription:        queryJSONModel.Subscription,
			ResourceGroup:       resourceGroup,
			MetricNamespace:     azJSONModel.MetricNamespace,
			ResourceName:        resourceName,
		}

		// Construct the resourceURI (for legacy query objects pre Grafana 9)
		resourceUri, err := ub.buildResourceURI()
		if err != nil {
			return nil, err
		}

		// POST requests are only supported at the subscription level
		filterInBody = false
		if resourceUri != nil {
			azureURL = fmt.Sprintf("%s/providers/microsoft.insights/metrics", *resourceUri)
			// Store the resource URI in the map lowercased to avoid case sensitivity issues
			uriLower := strings.ToLower(*resourceUri)
			resourceMap[uriLower] = dataquery.AzureMonitorResource{ResourceGroup: resourceGroup, ResourceName: resourceName}
		}
	} else {
		for _, r := range azJSONModel.Resources {
			ub := urlBuilder{
				DefaultSubscription: &dsInfo.Settings.SubscriptionId,
				Subscription:        queryJSONModel.Subscription,
				ResourceGroup:       r.ResourceGroup,
				MetricNamespace:     azJSONModel.MetricNamespace,
				ResourceName:        r.ResourceName,
			}
			resourceUri, err := ub.buildResourceURI()
			if err != nil {
				return nil, err
			}

			if resourceUri != nil {
				// Store the resource URI in the map lowercased to avoid case sensitivity issues
				uriLower := strings.ToLower(*resourceUri)
				resourceMap[uriLower] = r
			}
			resourceIDs = append(resourceIDs, fmt.Sprintf("Microsoft.ResourceId eq '%s'", *resourceUri))
		}
	}

	// old model
	dimension := ""
	if azJSONModel.Dimension != nil {
		dimension = strings.TrimSpace(*azJSONModel.Dimension)
	}
	dimensionFilter := ""
	if azJSONModel.DimensionFilter != nil {
		dimensionFilter = strings.TrimSpace(*azJSONModel.DimensionFilter)
	}

	dimSB := strings.Builder{}

	if dimension != "" && dimensionFilter != "" && dimension != "None" && len(azJSONModel.DimensionFilters) == 0 {
		dimSB.WriteString(fmt.Sprintf("%s eq '%s'", dimension, dimensionFilter))
	} else {
		for i, filter := range azJSONModel.DimensionFilters {
			if len(filter.Filters) == 0 {
				dimSB.WriteString(fmt.Sprintf("%s eq '*'", *filter.Dimension))
			} else {
				dimSB.WriteString(types.ConstructFiltersString(filter))
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
	}

	params, err := getParams(azJSONModel, query)
	if err != nil {
		return nil, err
	}
	target = params.Encode()

	sub := ""
	if queryJSONModel.Subscription != nil {
		sub = *queryJSONModel.Subscription
	}

	azureQuery := &types.AzureMonitorQuery{
		URL:          azureURL,
		Target:       target,
		Params:       params,
		RefID:        query.RefID,
		Alias:        alias,
		TimeRange:    query.TimeRange,
		Dimensions:   azJSONModel.DimensionFilters,
		Resources:    resourceMap,
		Subscription: sub,
	}
	if filterString != "" {
		if filterInBody {
			azureQuery.BodyFilter = filterString
		} else {
			azureQuery.Params.Add("$filter", filterString)
		}
	}

	return azureQuery, nil
}

func getParams(azJSONModel *dataquery.AzureMetricQuery, query backend.DataQuery) (url.Values, error) {
	params := url.Values{}

	timeGrain := azJSONModel.TimeGrain
	timeGrains := azJSONModel.AllowedTimeGrainsMs

	if timeGrain != nil && *timeGrain == "auto" {
		var err error
		timeGrain, err = azTime.SetAutoTimeGrain(query.Interval.Milliseconds(), timeGrains)
		if err != nil {
			return nil, err
		}
	}
	params.Add("api-version", AzureMonitorAPIVersion)
	params.Add("timespan", fmt.Sprintf("%v/%v", query.TimeRange.From.UTC().Format(time.RFC3339), query.TimeRange.To.UTC().Format(time.RFC3339)))
	if timeGrain != nil {
		params.Add("interval", *timeGrain)
	}
	if azJSONModel.Aggregation != nil {
		params.Add("aggregation", *azJSONModel.Aggregation)
	}
	if azJSONModel.MetricName != nil {
		params.Add("metricnames", *azJSONModel.MetricName)
	}
	if azJSONModel.CustomNamespace != nil && *azJSONModel.CustomNamespace != "" {
		params.Add("metricnamespace", *azJSONModel.CustomNamespace)
	} else if azJSONModel.MetricNamespace != nil {
		params.Add("metricnamespace", *azJSONModel.MetricNamespace)
	}
	if azJSONModel.Region != nil && *azJSONModel.Region != "" {
		params.Add("region", *azJSONModel.Region)
	}
	if azJSONModel.Top != nil && *azJSONModel.Top != "" {
		params.Add("top", *azJSONModel.Top)
	}

	return params, nil
}

func (e *AzureMonitorDatasource) retrieveSubscriptionDetails(cli *http.Client, ctx context.Context, subscriptionId string, baseUrl string, dsId int64, orgId int64) (string, error) {
	req, err := e.createRequest(ctx, fmt.Sprintf("%s/subscriptions/%s", baseUrl, subscriptionId))
	if err != nil {
		return "", fmt.Errorf("failed to retrieve subscription details for subscription %s: %s", subscriptionId, err)
	}
	values := req.URL.Query()
	values.Add("api-version", "2022-12-01")
	req.URL.RawQuery = values.Encode()

	_, span := tracing.DefaultTracer().Start(ctx, "azuremonitor subscription query", trace.WithAttributes(
		attribute.String("subscription", subscriptionId),
		attribute.Int64("datasource_id", dsId),
		attribute.Int64("org_id", orgId),
	),
	)
	defer span.End()

	res, err := cli.Do(req)
	if err != nil {
		err = fmt.Errorf("failed to request subscription details: %s", err)
		if backend.IsDownstreamHTTPError(err) {
			err = backend.DownstreamError(err)
		}
		return "", err
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			e.Logger.Warn("Failed to close response body", "err", err)
		}
	}()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %s", err)
	}

	if res.StatusCode/100 != 2 {
		return "", utils.CreateResponseErrorFromStatusCode(res.StatusCode, res.Status, body)
	}

	var data types.SubscriptionsResponse
	err = json.Unmarshal(body, &data)
	if err != nil {
		return "", fmt.Errorf("failed to unmarshal subscription detail response. error: %s, status: %s, body: %s", err, res.Status, string(body))
	}

	return data.DisplayName, nil
}

func (e *AzureMonitorDatasource) executeQuery(ctx context.Context, query *types.AzureMonitorQuery, dsInfo types.DatasourceInfo, cli *http.Client, url string) (*backend.DataResponse, error) {
	req, err := e.createRequest(ctx, url)
	if err != nil {
		return nil, err
	}

	req.URL.Path = path.Join(req.URL.Path, query.URL)
	req.URL.RawQuery = query.Params.Encode()
	if query.BodyFilter != "" {
		req.Method = http.MethodPost
		req.Body = io.NopCloser(strings.NewReader(fmt.Sprintf(`{"filter": "%s"}`, query.BodyFilter)))
	}

	_, span := tracing.DefaultTracer().Start(ctx, "azuremonitor query", trace.WithAttributes(
		attribute.String("target", query.Target),
		attribute.Int64("from", query.TimeRange.From.UnixNano()/int64(time.Millisecond)),
		attribute.Int64("until", query.TimeRange.To.UnixNano()/int64(time.Millisecond)),
		attribute.Int64("datasource_id", dsInfo.DatasourceID),
		attribute.Int64("org_id", dsInfo.OrgID),
	),
	)
	defer span.End()

	res, err := cli.Do(req)
	if err != nil {
		return nil, backend.DownstreamError(err)
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			e.Logger.Warn("Failed to close response body", "err", err)
		}
	}()

	data, err := e.unmarshalResponse(res)
	if err != nil {
		return nil, err
	}

	subscription, err := e.retrieveSubscriptionDetails(cli, ctx, query.Subscription, dsInfo.Routes["Azure Monitor"].URL, dsInfo.DatasourceID, dsInfo.OrgID)
	if err != nil {
		return nil, err
	}

	frames, err := e.parseResponse(data, query, dsInfo.Routes["Azure Portal"].URL, subscription)
	if err != nil {
		return nil, err
	}

	dataResponse := backend.DataResponse{Frames: frames}
	return &dataResponse, nil
}

func (e *AzureMonitorDatasource) createRequest(ctx context.Context, url string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to create request", err)
	}
	req.Header.Set("Content-Type", "application/json")

	return req, nil
}

func (e *AzureMonitorDatasource) unmarshalResponse(res *http.Response) (types.AzureMonitorResponse, error) {
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return types.AzureMonitorResponse{}, err
	}

	if res.StatusCode/100 != 2 {
		return types.AzureMonitorResponse{}, utils.CreateResponseErrorFromStatusCode(res.StatusCode, res.Status, body)
	}

	var data types.AzureMonitorResponse
	err = json.Unmarshal(body, &data)
	if err != nil {
		return types.AzureMonitorResponse{}, err
	}

	return data, nil
}

func (e *AzureMonitorDatasource) parseResponse(amr types.AzureMonitorResponse, query *types.AzureMonitorQuery, azurePortalUrl string, subscription string) (data.Frames, error) {
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
		frame.Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti, TypeVersion: data.FrameTypeVersion{0, 1}}
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

		resourceIdLabel := "microsoft.resourceid"
		resourceID, ok := labels[resourceIdLabel]
		if !ok {
			resourceIdLabel = "Microsoft.ResourceId"
			resourceID = labels[resourceIdLabel]
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

		delete(labels, resourceIdLabel)
		labels["resourceName"] = resourceName

		if query.Alias != "" {
			displayName := formatAzureMonitorLegendKey(query, resourceID, &amr, labels, subscription)

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
		frameWithLink := loganalytics.AddConfigLinks(*frame, queryUrl, nil)
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

	timespan, err := json.Marshal(map[string]any{
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
	var grouping map[string]any

	if len(query.Dimensions) > 0 {
		for _, dimension := range query.Dimensions {
			var dimensionInt int
			dimensionFilters := dimension.Filters

			// Only the first dimension determines the splitting shown in the Azure Portal
			if grouping == nil {
				grouping = map[string]any{
					"dimension": dimension.Dimension,
					"sort":      2,
					"top":       10,
				}
			}

			if len(dimension.Filters) == 0 {
				continue
			}

			if dimension.Dimension == nil {
				continue
			}

			if dimension.Operator == nil {
				filter := types.AzureMonitorDimensionFilterBackend{
					Key:      *dimension.Dimension,
					Operator: 0,
					Values:   dimensionFilters,
				}
				filters = append(filters, filter)
				continue
			}
			switch *dimension.Operator {
			case "eq":
				dimensionInt = 0
			case "ne":
				dimensionInt = 1
			case "sw":
				dimensionInt = 3
			}

			filter := types.AzureMonitorDimensionFilterBackend{
				Key:      *dimension.Dimension,
				Operator: dimensionInt,
				Values:   dimensionFilters,
			}
			filters = append(filters, filter)
		}
	}

	chart := map[string]any{
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
		chart["filterCollection"] = map[string]any{
			"filters": filters,
		}
	}
	if grouping != nil {
		chart["grouping"] = grouping
	}

	chartDef, err := json.Marshal(map[string]any{
		"v2charts": []any{
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
func formatAzureMonitorLegendKey(query *types.AzureMonitorQuery, resourceId string, amr *types.AzureMonitorResponse, labels data.Labels, subscription string) string {
	alias := query.Alias
	subscriptionId := query.Subscription
	resource := query.Resources[strings.ToLower(resourceId)]
	metricName := amr.Value[0].Name.LocalizedValue
	namespace := amr.Namespace
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

		if metaPartName == "subscriptionid" {
			return []byte(subscriptionId)
		}

		if metaPartName == "subscription" {
			if subscription == "" {
				return []byte{}
			}
			return []byte(subscription)
		}

		if metaPartName == "resourcegroup" && resource.ResourceGroup != nil {
			return []byte(*resource.ResourceGroup)
		}

		if metaPartName == "namespace" {
			return []byte(namespace)
		}

		if metaPartName == "resourcename" && resource.ResourceName != nil {
			return []byte(*resource.ResourceName)
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

func hasOneResource(query dataquery.AzureMonitorQuery) (bool, *string, *string) {
	azJSONModel := query.AzureMonitor
	if len(azJSONModel.Resources) > 1 {
		return false, nil, nil
	}
	if len(azJSONModel.Resources) == 1 {
		return true, azJSONModel.Resources[0].ResourceGroup, azJSONModel.Resources[0].ResourceName
	}
	if (azJSONModel.ResourceGroup != nil && *azJSONModel.ResourceGroup != "") || (azJSONModel.ResourceName != nil && *azJSONModel.ResourceName != "") {
		// Deprecated, Resources should be used instead
		return true, azJSONModel.ResourceGroup, azJSONModel.ResourceName
	}
	return false, nil, nil
}

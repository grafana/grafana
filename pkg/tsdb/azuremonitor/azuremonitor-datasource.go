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

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	opentracing "github.com/opentracing/opentracing-go"
	"golang.org/x/net/context/ctxhttp"
)

// AzureMonitorDatasource calls the Azure Monitor API - one of the four API's supported
type AzureMonitorDatasource struct {
	pluginManager plugins.Manager
	cfg           *setting.Cfg
}

var (
	// 1m, 5m, 15m, 30m, 1h, 6h, 12h, 1d in milliseconds
	defaultAllowedIntervalsMS = []int64{60000, 300000, 900000, 1800000, 3600000, 21600000, 43200000, 86400000}
)

const azureMonitorAPIVersion = "2018-01-01"

// executeTimeSeriesQuery does the following:
// 1. build the AzureMonitor url and querystring for each query
// 2. executes each query by calling the Azure Monitor API
// 3. parses the responses for each query into data frames
func (e *AzureMonitorDatasource) executeTimeSeriesQuery(ctx context.Context, originalQueries []backend.DataQuery, dsInfo datasourceInfo) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()

	queries, err := e.buildQueries(originalQueries, dsInfo)
	if err != nil {
		return nil, err
	}

	for _, query := range queries {
		queryRes, resp, err := e.executeQuery(ctx, query, dsInfo)
		if err != nil {
			return nil, err
		}

		frames, err := e.parseResponse(resp, query)
		if err != nil {
			queryRes.Error = err
		} else {
			queryRes.Frames = frames
		}
		result.Responses[query.RefID] = queryRes
	}

	return result, nil
}

func (e *AzureMonitorDatasource) buildQueries(queries []backend.DataQuery, dsInfo datasourceInfo) ([]*AzureMonitorQuery, error) {
	azureMonitorQueries := []*AzureMonitorQuery{}

	for _, query := range queries {
		var target string
		queryJSONModel := azureMonitorJSONQuery{}
		err := json.Unmarshal(query.JSON, &queryJSONModel)
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
			DefaultSubscription: dsInfo.Settings.SubscriptionId,
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
			timeGrain, err = setAutoTimeGrain(query.Interval.Milliseconds(), timeGrains)
			if err != nil {
				return nil, err
			}
		}

		params := url.Values{}
		params.Add("api-version", azureMonitorAPIVersion)
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
				dimSB.WriteString(filter.String())
				if i != len(azJSONModel.DimensionFilters)-1 {
					dimSB.WriteString(" and ")
				}
			}
		}

		if dimSB.String() != "" {
			params.Add("$filter", dimSB.String())
			params.Add("top", azJSONModel.Top)
		}

		target = params.Encode()

		if setting.Env == setting.Dev {
			azlog.Debug("Azuremonitor request", "params", params)
		}

		azureMonitorQueries = append(azureMonitorQueries, &AzureMonitorQuery{
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

func (e *AzureMonitorDatasource) executeQuery(ctx context.Context, query *AzureMonitorQuery, dsInfo datasourceInfo) (backend.DataResponse, AzureMonitorResponse, error) {
	dataResponse := backend.DataResponse{}

	req, err := e.createRequest(ctx, dsInfo)
	if err != nil {
		dataResponse.Error = err
		return dataResponse, AzureMonitorResponse{}, nil
	}

	req.URL.Path = path.Join(req.URL.Path, query.URL)
	req.URL.RawQuery = query.Params.Encode()

	span, ctx := opentracing.StartSpanFromContext(ctx, "azuremonitor query")
	span.SetTag("target", query.Target)
	span.SetTag("from", query.TimeRange.From.UnixNano()/int64(time.Millisecond))
	span.SetTag("until", query.TimeRange.To.UnixNano()/int64(time.Millisecond))
	span.SetTag("datasource_id", dsInfo.DatasourceID)
	span.SetTag("org_id", dsInfo.OrgID)

	defer span.Finish()

	if err := opentracing.GlobalTracer().Inject(
		span.Context(),
		opentracing.HTTPHeaders,
		opentracing.HTTPHeadersCarrier(req.Header)); err != nil {
		dataResponse.Error = err
		return dataResponse, AzureMonitorResponse{}, nil
	}

	azlog.Debug("AzureMonitor", "Request ApiURL", req.URL.String())
	azlog.Debug("AzureMonitor", "Target", query.Target)
	res, err := ctxhttp.Do(ctx, dsInfo.HTTPClient, req)
	if err != nil {
		dataResponse.Error = err
		return dataResponse, AzureMonitorResponse{}, nil
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			azlog.Warn("Failed to close response body", "err", err)
		}
	}()

	data, err := e.unmarshalResponse(res)
	if err != nil {
		dataResponse.Error = err
		return dataResponse, AzureMonitorResponse{}, nil
	}

	return dataResponse, data, nil
}

func (e *AzureMonitorDatasource) createRequest(ctx context.Context, dsInfo datasourceInfo) (*http.Request, error) {
	// find plugin
	plugin := e.pluginManager.GetDataSource(dsName)
	if plugin == nil {
		return nil, errors.New("unable to find datasource plugin Azure Monitor")
	}

	azureMonitorRoute, routeName, err := e.getPluginRoute(plugin, dsInfo)
	if err != nil {
		return nil, err
	}

	u, err := url.Parse(dsInfo.URL)
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

	// TODO: Use backend authentication instead
	proxyPass := fmt.Sprintf("%s/subscriptions", routeName)
	pluginproxy.ApplyRoute(ctx, req, proxyPass, azureMonitorRoute, &models.DataSource{
		JsonData:       simplejson.NewFromAny(dsInfo.JSONData),
		SecureJsonData: securejsondata.GetEncryptedJsonData(dsInfo.DecryptedSecureJSONData),
	}, e.cfg)

	return req, nil
}

func (e *AzureMonitorDatasource) getPluginRoute(plugin *plugins.DataSourcePlugin, dsInfo datasourceInfo) (*plugins.AppPluginRoute, string, error) {
	cloud, err := getAzureCloud(e.cfg, dsInfo)
	if err != nil {
		return nil, "", err
	}

	routeName, err := getManagementApiRoute(cloud)
	if err != nil {
		return nil, "", err
	}

	var pluginRoute *plugins.AppPluginRoute
	for _, route := range plugin.Routes {
		if route.Path == routeName {
			pluginRoute = route
			break
		}
	}

	return pluginRoute, routeName, nil
}

func (e *AzureMonitorDatasource) unmarshalResponse(res *http.Response) (AzureMonitorResponse, error) {
	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return AzureMonitorResponse{}, err
	}

	if res.StatusCode/100 != 2 {
		azlog.Debug("Request failed", "status", res.Status, "body", string(body))
		return AzureMonitorResponse{}, fmt.Errorf("request failed, status: %s", res.Status)
	}

	var data AzureMonitorResponse
	err = json.Unmarshal(body, &data)
	if err != nil {
		azlog.Debug("Failed to unmarshal AzureMonitor response", "error", err, "status", res.Status, "body", string(body))
		return AzureMonitorResponse{}, err
	}

	return data, nil
}

func (e *AzureMonitorDatasource) parseResponse(amr AzureMonitorResponse, query *AzureMonitorQuery) (
	data.Frames, error) {
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

		frames = append(frames, frame)
	}

	return frames, nil
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

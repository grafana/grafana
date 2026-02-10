package metrics

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/loganalytics"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

// parseBatchResponse parses the batch API response and distributes results to queries
func (e *AzureMonitorDatasource) parseBatchResponse(
	batchResponse *types.AzureMonitorBatchResponse,
	batch *types.BatchQueryGroup,
	azurePortalUrl string,
	subscription string,
) (map[string]backend.DataResponse, error) {
	responses := make(map[string]backend.DataResponse)

	// Create a map of resource ID to batch value for quick lookup
	resourceMap := make(map[string]*types.AzureMonitorBatchValue)
	for i := range batchResponse.Values {
		value := &batchResponse.Values[i]
		// Normalize resource ID to lowercase for case-insensitive matching
		resourceIdLower := strings.ToLower(value.ResourceId)
		resourceMap[resourceIdLower] = value
	}

	// Process each query in the batch
	for _, query := range batch.Queries {
		// Get the resource IDs for this query
		resourceIds := extractResourceIdsFromQuery(query)

		allFrames := data.Frames{}
		hasError := false
		var firstError error

		// Process each resource in the query
		for _, resourceId := range resourceIds {
			resourceIdLower := strings.ToLower(resourceId)
			batchValue, exists := resourceMap[resourceIdLower]

			if !exists {
				// Resource not in response - this could be an error
				e.Logger.Warn("Resource not found in batch response", "resourceId", resourceId)
				continue
			}

			// Check for errors in the response
			if len(batchValue.Value) > 0 {
				for _, metric := range batchValue.Value {
					if metric.ErrorCode != "Success" && metric.ErrorCode != "" {
						hasError = true
						if firstError == nil {
							errorMsg := metric.ErrorMessage
							if errorMsg == "" {
								errorMsg = metric.ErrorCode
							}
							firstError = fmt.Errorf("metric error for resource %s: %s", resourceId, errorMsg)
						}
						e.Logger.Warn("Error in batch metric", "resourceId", resourceId, "errorCode", metric.ErrorCode, "errorMessage", metric.ErrorMessage)
						continue
					}

					// Parse the metric data into frames
					frames, err := e.parseBatchMetric(batchValue, &metric, query, azurePortalUrl, subscription, resourceId)
					if err != nil {
						if firstError == nil {
							firstError = err
						}
						hasError = true
						continue
					}

					allFrames = append(allFrames, frames...)
				}
			}
		}

		// Create the response for this query
		if hasError && len(allFrames) == 0 {
			// All resources failed, return error
			responses[query.RefID] = backend.ErrorResponseWithErrorSource(firstError)
		} else {
			// Return frames (even if partial)
			responses[query.RefID] = backend.DataResponse{Frames: allFrames}
		}
	}

	return responses, nil
}

// parseBatchMetric parses a single metric from the batch response into data frames
func (e *AzureMonitorDatasource) parseBatchMetric(
	batchValue *types.AzureMonitorBatchValue,
	metric *struct {
		Name struct {
			Value          string `json:"value"`
			LocalizedValue string `json:"localizedValue"`
		} `json:"name"`
		Unit       string `json:"unit"`
		Timeseries []struct {
			Metadatavalues []struct {
				Name struct {
					Value          string `json:"value"`
					LocalizedValue string `json:"localizedValue"`
				} `json:"name"`
				Value string `json:"value"`
			} `json:"metadatavalues"`
			Data []struct {
				TimeStamp time.Time `json:"timeStamp"`
				Average   *float64  `json:"average,omitempty"`
				Total     *float64  `json:"total,omitempty"`
				Count     *float64  `json:"count,omitempty"`
				Maximum   *float64  `json:"maximum,omitempty"`
				Minimum   *float64  `json:"minimum,omitempty"`
			} `json:"data"`
		} `json:"timeseries"`
		ErrorCode    string `json:"errorCode"`
		ErrorMessage string `json:"errorMessage,omitempty"`
	},
	query *types.AzureMonitorQuery,
	azurePortalUrl string,
	subscription string,
	resourceId string,
) (data.Frames, error) {
	frames := data.Frames{}

	if len(metric.Timeseries) == 0 {
		return nil, nil
	}

	for _, series := range metric.Timeseries {
		// Build labels from metadata
		labels := data.Labels{}
		for _, md := range series.Metadatavalues {
			labels[md.Name.LocalizedValue] = md.Value
		}

		// Create the data frame
		frame := data.NewFrameOfFieldTypes("", len(series.Data), data.FieldTypeTime, data.FieldTypeNullableFloat64)
		frame.Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti, TypeVersion: data.FrameTypeVersion{0, 1}}
		frame.RefID = query.RefID

		timeField := frame.Fields[0]
		timeField.Name = data.TimeSeriesTimeFieldName

		dataField := frame.Fields[1]
		dataField.Name = metric.Name.LocalizedValue
		dataField.Labels = labels

		if metric.Unit != "Unspecified" {
			dataField.SetConfig(&data.FieldConfig{
				Unit: toGrafanaUnit(metric.Unit),
			})
		}

		// Extract resource name from resource ID
		resourceIDSlice := strings.Split(resourceId, "/")
		resourceName := ""
		if len(resourceIDSlice) > 1 {
			resourceName = resourceIDSlice[len(resourceIDSlice)-1]
		}

		// Add resource name to labels
		labels["resourceName"] = resourceName

		// Handle alias formatting
		if query.Alias != "" {
			displayName := formatBatchLegendKey(query, resourceId, batchValue.Namespace, metric.Name.LocalizedValue, labels, subscription)

			if dataField.Config != nil {
				dataField.Config.DisplayName = displayName
			} else {
				dataField.SetConfig(&data.FieldConfig{
					DisplayName: displayName,
				})
			}
		}

		// Get the requested aggregation
		requestedAgg := query.Params.Get("aggregation")

		// Fill in the data points
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

		// Add deep link to Azure Portal
		queryUrl, err := getQueryUrl(query, azurePortalUrl, resourceId, resourceName)
		if err != nil {
			return nil, err
		}
		frameWithLink := loganalytics.AddConfigLinks(*frame, queryUrl, nil)
		frames = append(frames, &frameWithLink)
	}

	return frames, nil
}

// formatBatchLegendKey formats the legend key for batch API responses
func formatBatchLegendKey(query *types.AzureMonitorQuery, resourceId, namespace, metricName string, labels data.Labels, subscription string) string {
	alias := query.Alias
	subscriptionId := query.Subscription
	resource := query.Resources[strings.ToLower(resourceId)]

	// Could be a collision problem if there were two keys that varied only in case
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

// extractQueryResultFromBatch extracts the result for a specific query from a batch response
func extractQueryResultFromBatch(batchResponse *types.AzureMonitorBatchResponse, query *types.AzureMonitorQuery) *backend.DataResponse {
	// This is a simplified version - the actual implementation is in parseBatchResponse
	// which handles multiple queries at once
	return &backend.DataResponse{Frames: data.Frames{}}
}

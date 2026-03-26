package metrics

import (
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/loganalytics"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

// distributeBatchResults collects frames from all batch results into a single
// data.Frames slice. Each frame carries its RefID. Errors from failed batches
// or resource-level failures are joined and returned alongside any frames that
// did succeed.
func distributeBatchResults(results []batchResult, azurePortalURL, subscription string) (data.Frames, error) {
	var frames data.Frames
	var errs []error

	for _, result := range results {
		if result.Err != nil {
			errs = append(errs, result.Err)
			continue
		}

		f, err := parseBatchResponse(result, azurePortalURL, subscription)
		frames = append(frames, f...)
		if err != nil {
			errs = append(errs, err)
		}
	}

	return frames, errors.Join(errs...)
}

// parseBatchResponse converts a successful batch result into a flat data.Frames
// slice. Each frame carries its RefID. Resource-level errors are joined and
// returned alongside any frames that did succeed.
func parseBatchResponse(result batchResult, azurePortalURL, subscription string) (data.Frames, error) {
	var frames data.Frames
	var errs []error

	// Build a lookup from lowercase resource ID -> query.
	// Keys in query.Resources are already stored lowercase (see buildQuery).
	resourceToQuery := make(map[string]*types.AzureMonitorQuery)
	for _, query := range result.Batch.Queries {
		for resourceID := range query.Resources {
			resourceToQuery[resourceID] = query
		}
	}

	for _, resourceValue := range result.Response.Values {
		query, ok := resourceToQuery[strings.ToLower(resourceValue.ResourceID)]
		if !ok {
			continue
		}

		f, err := framesFromBatchResponseValue(resourceValue, query, azurePortalURL, subscription)
		if err != nil {
			errs = append(errs, err)
		} else {
			frames = append(frames, f...)
		}
	}

	return frames, errors.Join(errs...)
}

// framesFromBatchResponseValue converts a single resource's batch response entry
// into data.Frames, mirroring the logic of parseResponse for the ARM API.
func framesFromBatchResponseValue(resourceValue batchResponseValue, query *types.AzureMonitorQuery, azurePortalURL, subscription string) (data.Frames, error) {
	resourceID := resourceValue.ResourceID
	resourceIDParts := strings.Split(resourceID, "/")
	resourceName := resourceIDParts[len(resourceIDParts)-1]

	var frames data.Frames

	for _, metric := range resourceValue.Value {
		if metric.ErrorCode != "" && metric.ErrorCode != "Success" {
			return nil, fmt.Errorf("metric %q for resource %q: %s", metric.Name.Value, resourceID, metric.ErrorCode)
		}

		for _, series := range metric.Timeseries {
			labels := data.Labels{}
			for _, md := range series.Metadatavalues {
				labels[md.Name.LocalizedValue] = md.Value
			}
			labels["resourceName"] = resourceName

			frame := data.NewFrameOfFieldTypes("", len(series.Data), data.FieldTypeTime, data.FieldTypeNullableFloat64)
			frame.Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti, TypeVersion: data.FrameTypeVersion{0, 1}}
			frame.RefID = query.RefID
			frame.Fields[0].Name = data.TimeSeriesTimeFieldName

			dataField := frame.Fields[1]
			dataField.Name = metric.Name.LocalizedValue
			dataField.Labels = labels
			if metric.Unit != "Unspecified" {
				dataField.SetConfig(&data.FieldConfig{
					Unit: toGrafanaUnit(metric.Unit),
				})
			}

			if query.Alias != "" {
				// Construct a minimal AzureMonitorResponse to reuse formatAzureMonitorLegendKey.
				amr := types.AzureMonitorResponse{
					Namespace:      resourceValue.Namespace,
					Resourceregion: resourceValue.ResourceRegion,
					Value:          []types.AzureMetricValue{metric.AzureMetricValue},
				}
				displayName := formatAzureMonitorLegendKey(query, resourceID, &amr, labels, subscription)
				if dataField.Config != nil {
					dataField.Config.DisplayName = displayName
				} else {
					dataField.SetConfig(&data.FieldConfig{DisplayName: displayName})
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

			queryURL, err := getQueryUrl(query, azurePortalURL, resourceID, resourceName)
			if err != nil {
				return nil, err
			}
			frameWithLink := loganalytics.AddConfigLinks(*frame, queryURL, nil)
			frames = append(frames, &frameWithLink)
		}
	}

	return frames, nil
}

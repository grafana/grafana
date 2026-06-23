package metrics

import (
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

// parseBatchResponse converts a successful batch result into a flat data.Frames
// slice. Each frame carries its RefID. Resource-level errors are joined and
// returned alongside any frames that did succeed.
func parseBatchResponse(result batchResult, azurePortalURL string) (data.Frames, error) {
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

		f, err := framesFromBatchResponseValue(resourceValue, query, azurePortalURL)
		frames = append(frames, f...)
		if err != nil {
			errs = append(errs, err)
		}
	}

	return frames, errors.Join(errs...)
}

// framesFromBatchResponseValue converts a single resource's batch response entry
// into data.Frames, mirroring the logic of parseResponse for the ARM API.
func framesFromBatchResponseValue(resourceValue batchResponseValue, query *types.AzureMonitorQuery, azurePortalURL string) (data.Frames, error) {
	resourceID := resourceValue.ResourceID
	// Trim any trailing slash before extracting the last path segment to avoid
	// an empty resourceName when the API returns an ID ending with "/".
	resourceIDParts := strings.Split(strings.TrimRight(resourceID, "/"), "/")
	resourceName := resourceIDParts[len(resourceIDParts)-1]

	var frames data.Frames
	var errs []error

	for _, metric := range resourceValue.Value {
		if metric.ErrorCode != "" && metric.ErrorCode != "Success" {
			errs = append(errs, fmt.Errorf("metric %q for resource %q: %s", metric.Name.Value, resourceID, metric.ErrorCode))
			continue
		}

		for _, series := range metric.Timeseries {
			labels := data.Labels{}
			for _, md := range series.Metadatavalues {
				labels[md.Name.LocalizedValue] = md.Value
			}

			// Minimal AzureMonitorResponse so the shared builder can format the
			// legend; formatAzureMonitorLegendKey reads only Namespace and Value[0].
			amr := types.AzureMonitorResponse{
				Namespace: resourceValue.Namespace,
				Value:     []types.AzureMetricValue{metric.AzureMetricValue},
			}

			frame, err := buildMetricFrame(metricFrameInput{
				query:        query,
				series:       series,
				labels:       labels,
				metricName:   metric.Name.LocalizedValue,
				unit:         metric.Unit,
				resourceID:   resourceID,
				resourceName: resourceName,
				amr:          &amr,
				// Use query.Subscription so {{subscription}} resolves to the
				// per-resource subscription rather than the datasource default.
				subscription: query.Subscription,
			}, azurePortalURL)
			if err != nil {
				errs = append(errs, err)
				continue
			}
			frames = append(frames, frame)
		}
	}

	return frames, errors.Join(errs...)
}

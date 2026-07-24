package metrics

import (
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

// parseBatchResponse converts a successful batch result into a flat data.Frames
// slice. Each frame carries its RefID. Resource-level errors are returned per
// RefID (joined when a query has several) alongside any frames that did
// succeed, so one query's failure never marks its batch siblings failed —
// matching parseFallbackResponse and the legacy per-query path. subscription is
// the resolved subscription display name substituted for {{subscription}} in
// legends, matching the legacy ARM path; all queries in a batch share one
// subscription (it is part of the batch group key).
func parseBatchResponse(result batchResult, azurePortalURL string, subscription string, logger log.Logger) (data.Frames, map[string]error) {
	var frames data.Frames
	errsByRefID := make(map[string][]error)

	// Build a lookup from lowercase resource ID -> all queries that own it.
	// Keys in query.Resources are already stored lowercase (see buildQuery).
	// A resource can be owned by more than one query: the batch group key
	// excludes RefID and Alias, so two queries with identical parameters (e.g. a
	// duplicated panel query) or overlapping resource selections share a batch,
	// and resourceIDsForGroup dedupes the shared IDs. Each owning query must
	// receive its own frames — with its own RefID and legend/alias formatting —
	// or all but one would silently get no data.
	resourceToQueries := make(map[string][]*types.AzureMonitorQuery)
	for _, query := range result.Batch.Queries {
		for resourceID := range query.Resources {
			resourceToQueries[resourceID] = append(resourceToQueries[resourceID], query)
		}
	}

	for _, resourceValue := range result.Response.Values {
		queries, ok := resourceToQueries[strings.ToLower(resourceValue.ResourceID)]
		if !ok {
			// Should not happen: the batch only requests resource IDs owned by
			// its queries (createBatches invariant), and the API echoes them
			// back. Log so a request/response mismatch is diagnosable rather
			// than silently showing up as missing data.
			logger.Warn("batch response contained a resource ID not present in any query; skipping",
				"resourceID", resourceValue.ResourceID)
			continue
		}

		for _, query := range queries {
			f, err := framesFromBatchResponseValue(resourceValue, query, azurePortalURL, subscription)
			frames = append(frames, f...)
			if err != nil {
				errsByRefID[query.RefID] = append(errsByRefID[query.RefID], err)
			}
		}
	}

	joined := make(map[string]error, len(errsByRefID))
	for refID, errs := range errsByRefID {
		joined[refID] = errors.Join(errs...)
	}
	return frames, joined
}

// framesFromBatchResponseValue converts a single resource's batch response entry
// into data.Frames, mirroring the logic of parseResponse for the ARM API.
// subscription is the resolved subscription display name used for
// {{subscription}} legend substitution.
func framesFromBatchResponseValue(resourceValue batchResponseValue, query *types.AzureMonitorQuery, azurePortalURL string, subscription string) (data.Frames, error) {
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
				// The resolved display name, so {{subscription}} renders the
				// friendly name exactly like the legacy ARM path.
				subscription: subscription,
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

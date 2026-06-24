package metrics

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/config"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

// isBatchableQuery reports whether a backend query can be sent to the Metrics
// Batch API. Queries that use a custom namespace (custom metrics, Application
// Insights custom telemetry) or a Guest OS / Windows Azure Diagnostics (WAD)
// namespace must fall back to the legacy ARM metrics endpoint; those metrics
// are not exposed via the metrics-batch data plane.
func isBatchableQuery(query backend.DataQuery) bool {
	var model dataquery.AzureMonitorQuery
	if err := json.Unmarshal(query.JSON, &model); err != nil {
		return false
	}
	az := model.AzureMonitor
	if az == nil {
		return false
	}
	if az.CustomNamespace != nil && *az.CustomNamespace != "" {
		return false
	}
	if az.MetricNamespace != nil {
		ns := strings.ToLower(strings.TrimSpace(*az.MetricNamespace))
		// Guest OS metrics use the namespaces "azure.vm.windows.guestmetrics"
		// and "azure.vm.linux.guestmetrics"; legacy Windows Azure Diagnostics
		// (WAD) metrics use "windows azure"/"wad" namespaces. None of these are
		// resource types, so they are not supported by the metrics-batch data
		// plane and must fall back to the legacy ARM endpoint.
		if strings.HasPrefix(ns, "azure.vm.") ||
			strings.HasPrefix(ns, "windows azure") ||
			strings.HasPrefix(ns, "wad") {
			return false
		}
	}
	return true
}

// cloneQueryWithResources returns a copy of query whose embedded AzureMonitor
// model is shallow-copied with Resources overridden (and Subscription/Region
// overridden when the corresponding argument is non-nil). All other query
// fields are preserved. A shallow copy is sufficient because only whole fields
// are replaced, never mutated in place.
func cloneQueryWithResources(query backend.DataQuery, model dataquery.AzureMonitorQuery, resources []dataquery.AzureMonitorResource, sub, region *string) (backend.DataQuery, error) {
	azCopy := *model.AzureMonitor
	azCopy.Resources = resources
	if region != nil {
		azCopy.Region = region
	}
	modelCopy := model
	modelCopy.AzureMonitor = &azCopy
	if sub != nil {
		modelCopy.Subscription = sub
	}

	copyJSON, err := json.Marshal(modelCopy)
	if err != nil {
		return backend.DataQuery{}, err
	}
	queryCopy := query
	queryCopy.JSON = copyJSON
	return queryCopy, nil
}

// fanOutByResource splits a multi-resource query into one backend.DataQuery
// per resource. Single-resource and legacy queries are returned unchanged.
// Used to fan out non-batchable queries (e.g. custom namespace) so that each
// resource is fetched via its own resource-level ARM URL.
func fanOutByResource(query backend.DataQuery) ([]backend.DataQuery, error) {
	var model dataquery.AzureMonitorQuery
	if err := json.Unmarshal(query.JSON, &model); err != nil {
		return nil, err
	}
	az := model.AzureMonitor
	if az == nil || len(az.Resources) <= 1 {
		return []backend.DataQuery{query}, nil
	}

	queries := make([]backend.DataQuery, 0, len(az.Resources))
	for _, resource := range az.Resources {
		// Use the resource's own subscription so the ARM URL targets the correct
		// subscription when resources span multiple subscriptions.
		var sub *string
		if resource.Subscription != nil && *resource.Subscription != "" {
			sub = resource.Subscription
		}
		queryCopy, err := cloneQueryWithResources(query, model, []dataquery.AzureMonitorResource{resource}, sub, nil)
		if err != nil {
			return nil, err
		}
		queries = append(queries, queryCopy)
	}
	return queries, nil
}

// buildQueriesForBatch is like buildQuery but splits multi-resource queries into
// separate AzureMonitorQuery objects per (subscription, region) pair so that
// groupQueriesForBatch can correctly route each resource to the right batch endpoint.
// Single-resource and legacy queries are passed through unchanged.
func (e *AzureMonitorDatasource) buildQueriesForBatch(query backend.DataQuery, dsInfo types.DatasourceInfo) ([]*types.AzureMonitorQuery, error) {
	queryJSONModel := dataquery.AzureMonitorQuery{}
	if err := json.Unmarshal(query.JSON, &queryJSONModel); err != nil {
		return nil, fmt.Errorf("failed to decode the Azure Monitor query object from JSON: %w", err)
	}

	azJSONModel := queryJSONModel.AzureMonitor

	// Determine the query-level defaults for subscription and region.
	defaultSub := dsInfo.Settings.SubscriptionId
	if queryJSONModel.Subscription != nil && *queryJSONModel.Subscription != "" {
		defaultSub = *queryJSONModel.Subscription
	}

	// Single-resource or legacy queries need no splitting.
	if hasOne, _, _ := hasOneResource(queryJSONModel); hasOne || len(azJSONModel.Resources) == 0 {
		q, err := e.buildQuery(query, dsInfo)
		if err != nil {
			return nil, err
		}
		if q.Subscription == "" {
			q.Subscription = defaultSub
		}
		return []*types.AzureMonitorQuery{q}, nil
	}
	defaultRegion := ""
	if azJSONModel.Region != nil {
		defaultRegion = *azJSONModel.Region
	}

	// Group resources by their effective (subscription, region) pair.
	type subRegionKey struct{ sub, region string }
	groupedResources := make(map[subRegionKey][]dataquery.AzureMonitorResource)
	var orderedKeys []subRegionKey

	for _, r := range azJSONModel.Resources {
		sub := defaultSub
		if r.Subscription != nil && *r.Subscription != "" {
			sub = *r.Subscription
		}
		region := defaultRegion
		if r.Region != nil && *r.Region != "" {
			region = *r.Region
		}
		key := subRegionKey{sub: sub, region: region}
		if _, exists := groupedResources[key]; !exists {
			orderedKeys = append(orderedKeys, key)
		}
		groupedResources[key] = append(groupedResources[key], r)
	}

	// All resources share the same (subscription, region); no splitting needed.
	if len(orderedKeys) == 1 {
		q, err := e.buildQuery(query, dsInfo)
		if err != nil {
			return nil, err
		}
		if q.Subscription == "" {
			q.Subscription = orderedKeys[0].sub
		}
		return []*types.AzureMonitorQuery{q}, nil
	}

	// Build one AzureMonitorQuery per (subscription, region) group.
	var result []*types.AzureMonitorQuery
	for _, key := range orderedKeys {
		sub, region := key.sub, key.region
		queryCopy, err := cloneQueryWithResources(query, queryJSONModel, groupedResources[key], &sub, &region)
		if err != nil {
			return nil, fmt.Errorf("failed to re-encode split query for subscription %q region %q: %w", key.sub, key.region, err)
		}

		q, err := e.buildQuery(queryCopy, dsInfo)
		if err != nil {
			return nil, err
		}
		result = append(result, q)
	}
	return result, nil
}

// executeBatchTimeSeriesQuery groups all queries into Metrics Batch API requests,
// executes them in parallel, and distributes the resulting frames back to their
// original RefIDs. Queries that cannot use the batch API (custom metrics, Guest
// OS metrics) are executed individually via the legacy ARM endpoint.
func (e *AzureMonitorDatasource) executeBatchTimeSeriesQuery(ctx context.Context, originalQueries []backend.DataQuery, dsInfo types.DatasourceInfo, client *http.Client) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()

	armURL := dsInfo.Routes[types.RouteAzureMonitor].URL

	// Use the dedicated data-plane client for batch requests so that requests to
	// *.metrics.monitor.azure.com carry a token scoped to that audience rather
	// than the ARM audience.
	svc, ok := dsInfo.Services[types.RouteAzureMonitorBatchMetrics]
	if !ok {
		return nil, fmt.Errorf("batch API requires the %q service to be configured; ensure the datasource has a data-plane route for metrics.monitor.azure.com", types.RouteAzureMonitorBatchMetrics)
	}
	batchClient := svc.HTTPClient

	// Separate batchable from non-batchable (custom namespace / Guest OS) queries.
	// Non-batchable queries are executed individually via the legacy ARM endpoint.
	var batchableQueries []backend.DataQuery
	for _, query := range originalQueries {
		batchable := isBatchableQuery(query)
		e.Logger.Debug("query batchability", "refID", query.RefID, "batchable", batchable)
		if !batchable {
			subQueries, err := fanOutByResource(query)
			if err != nil {
				result.Responses[query.RefID] = backend.ErrorResponseWithErrorSource(err)
				continue
			}
			e.Logger.Debug("split non-batchable query", "refID", query.RefID, "numSubQueries", len(subQueries))
			var subErrs []error
			for i, subQuery := range subQueries {
				azureQuery, err := e.buildQuery(subQuery, dsInfo)
				if err != nil {
					e.Logger.Debug("buildQuery error", "refID", query.RefID, "subQuery", i, "err", err)
					subErrs = append(subErrs, err)
					continue
				}
				e.Logger.Debug("executing sub-query", "refID", query.RefID, "subQuery", i, "url", azureQuery.URL)
				res, err := e.executeQuery(ctx, azureQuery, dsInfo, client, armURL)
				if err != nil {
					e.Logger.Debug("executeQuery error", "refID", query.RefID, "subQuery", i, "err", err)
					subErrs = append(subErrs, err)
					continue
				}
				e.Logger.Debug("sub-query result", "refID", query.RefID, "subQuery", i, "numFrames", len(res.Frames))
				dr := result.Responses[query.RefID]
				dr.Frames = append(dr.Frames, res.Frames...)
				result.Responses[query.RefID] = dr
			}
			if len(subErrs) > 0 {
				attachErr(result, query.RefID, errors.Join(subErrs...))
			}
		} else {
			batchableQueries = append(batchableQueries, query)
		}
	}

	// Build all batchable queries, splitting multi-resource queries by
	// (subscription, region) so that each AzureMonitorQuery targets a single
	// batch endpoint.
	var azureQueries []*types.AzureMonitorQuery
	for _, query := range batchableQueries {
		splitQueries, err := e.buildQueriesForBatch(query, dsInfo)
		if err != nil {
			result.Responses[query.RefID] = backend.ErrorResponseWithErrorSource(err)
			continue
		}
		azureQueries = append(azureQueries, splitQueries...)
	}

	if len(azureQueries) == 0 {
		return result, nil
	}

	// Group into batches and execute all in parallel.
	batches := createBatches(groupQueriesForBatch(azureQueries))
	batchResults := executeBatchRequests(ctx, batches, batchClient)

	// When a batch fails with a retryable error, fall back to re-fetching that batch's
	// resources via the ARM /batch endpoint (gated behind a flag). Build a RefID to original
	// query map so the fallback can rebuild per-resource queries.
	fallbackEnabled := config.GrafanaConfigFromContext(ctx).FeatureToggles().IsEnabled("azureMonitor.batchFallback")
	originalByRefID := make(map[string]backend.DataQuery, len(batchableQueries))
	for _, q := range batchableQueries {
		originalByRefID[q.RefID] = q
	}

	// For each batch: distribute frames to their RefID responses, then attribute
	// any error (HTTP failure or per-metric parse error) to the affected queries.
	// Frames from successful batches are preserved even when another batch fails.
	azurePortalURL := dsInfo.Routes[types.RouteAzurePortal].URL
	for _, br := range batchResults {
		if br.Err != nil {
			if fallbackEnabled && isRetryableStatus(br.StatusCode) {
				e.fallbackBatch(ctx, br, originalByRefID, dsInfo, client, armURL, azurePortalURL, result)
			} else {
				// Not retryable (or fallback disabled): attribute the error to every
				// query in the batch.
				for _, q := range br.Batch.Queries {
					attachErr(result, q.RefID, br.Err)
				}
			}
			continue
		}

		// Successful HTTP response: parse and distribute frames.
		frames, parseErr := parseBatchResponse(br, azurePortalURL)
		appendFrames(result, frames)
		if parseErr != nil {
			// Per-metric or parse error: surface to every query in the batch so
			// users see it in the Grafana UI rather than it being silently dropped.
			for _, q := range br.Batch.Queries {
				attachErr(result, q.RefID, parseErr)
			}
		}
	}

	return result, nil
}

// attachErr records err (with its error source) as the error for refID's
// response, preserving any frames already collected. If an error is already set
// on the response it is left untouched, so the first failure attributed to a
// query wins.
func attachErr(result *backend.QueryDataResponse, refID string, err error) {
	dr := result.Responses[refID]
	if dr.Error != nil {
		return
	}
	errResp := backend.ErrorResponseWithErrorSource(err)
	dr.Error = errResp.Error
	dr.ErrorSource = errResp.ErrorSource
	result.Responses[refID] = dr
}

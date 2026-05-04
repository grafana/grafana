package metrics

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

// isBatchableQuery reports whether a backend query can be sent to the Metrics
// Batch API. Queries that use a custom namespace (custom metrics, Application
// Insights custom telemetry) or a Guest OS / Windows Azure Diagnostics (WAD)
// namespace must fall back to the legacy ARM metrics endpoint — those metrics
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
		if strings.HasPrefix(ns, "windows azure") || strings.HasPrefix(ns, "wad") {
			return false
		}
	}
	return true
}

// splitQueryByResource splits a multi-resource query into one backend.DataQuery
// per resource. Single-resource and legacy queries are returned unchanged.
// Used to fan out non-batchable queries (e.g. custom namespace) so that each
// resource is fetched via its own resource-level ARM URL.
func splitQueryByResource(query backend.DataQuery) ([]backend.DataQuery, error) {
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
		azCopy := *az
		azCopy.Resources = []dataquery.AzureMonitorResource{resource}
		modelCopy := model
		modelCopy.AzureMonitor = &azCopy
		// Use the resource's own subscription so the ARM URL targets the correct
		// subscription when resources span multiple subscriptions.
		if resource.Subscription != nil && *resource.Subscription != "" {
			modelCopy.Subscription = resource.Subscription
		}

		copyJSON, err := json.Marshal(modelCopy)
		if err != nil {
			return nil, err
		}
		queryCopy := query
		queryCopy.JSON = copyJSON
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

	// All resources share the same (subscription, region) — no splitting needed.
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
		// Shallow-copy the model and override the fields that differ per group.
		azCopy := *azJSONModel
		azCopy.Resources = groupedResources[key]
		region := key.region
		azCopy.Region = &region
		sub := key.sub
		modelCopy := queryJSONModel
		modelCopy.Subscription = &sub
		modelCopy.AzureMonitor = &azCopy

		copyJSON, err := json.Marshal(modelCopy)
		if err != nil {
			return nil, fmt.Errorf("failed to re-encode split query for subscription %q region %q: %w", key.sub, key.region, err)
		}
		queryCopy := query
		queryCopy.JSON = copyJSON

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
			subQueries, err := splitQueryByResource(query)
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
				errResp := backend.ErrorResponseWithErrorSource(errors.Join(subErrs...))
				dr := result.Responses[query.RefID]
				dr.Error = errResp.Error
				dr.ErrorSource = errResp.ErrorSource
				result.Responses[query.RefID] = dr
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

	// For each batch: distribute frames to their RefID responses, then attribute
	// any error (HTTP failure or per-metric parse error) to the affected queries.
	// Frames from successful batches are preserved even when another batch fails.
	azurePortalURL := dsInfo.Routes[types.RouteAzurePortal].URL
	for _, br := range batchResults {
		if br.Err != nil {
			// HTTP-level failure: attribute the error to every query in the batch.
			for _, q := range br.Batch.Queries {
				dr := result.Responses[q.RefID]
				if dr.Error == nil {
					errResp := backend.ErrorResponseWithErrorSource(br.Err)
					dr.Error = errResp.Error
					dr.ErrorSource = errResp.ErrorSource
					result.Responses[q.RefID] = dr
				}
			}
			continue
		}

		// Successful HTTP response: parse and distribute frames.
		frames, parseErr := parseBatchResponse(br, azurePortalURL)
		for _, frame := range frames {
			dr := result.Responses[frame.RefID]
			dr.Frames = append(dr.Frames, frame)
			result.Responses[frame.RefID] = dr
		}
		if parseErr != nil {
			// Per-metric or parse error: surface to every query in the batch so
			// users see it in the Grafana UI rather than it being silently dropped.
			for _, q := range br.Batch.Queries {
				dr := result.Responses[q.RefID]
				if dr.Error == nil {
					errResp := backend.ErrorResponseWithErrorSource(parseErr)
					dr.Error = errResp.Error
					dr.ErrorSource = errResp.ErrorSource
					result.Responses[q.RefID] = dr
				}
			}
		}
	}

	return result, nil
}

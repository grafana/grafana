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

// isBatchableModel reports whether a query model can be sent to the Metrics
// Batch API. Queries that use a custom namespace (custom metrics, Application
// Insights custom telemetry) or a Guest OS / Windows Azure Diagnostics (WAD)
// namespace must fall back to the legacy ARM metrics endpoint — those metrics
// are not exposed via the metrics-batch data plane.
func isBatchableModel(model dataquery.AzureMonitorQuery) bool {
	az := model.AzureMonitor
	if az == nil {
		return false
	}
	// The batch API requires explicit resource IDs in the request body. Queries
	// without a Resources array — subscription-scoped queries and legacy
	// pre-Grafana-9 query objects using the deprecated top-level
	// resourceGroup/resourceName fields — must use the legacy ARM endpoint,
	// which supports those shapes. Otherwise such queries would produce no
	// batch entries and silently return no data.
	if len(az.Resources) == 0 {
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

// cloneQueryWithResources returns a copy of query whose JSON has Resources
// overridden (and Subscription/Region overridden when the corresponding
// argument is non-nil). All other fields are preserved byte-for-byte: the raw
// JSON is patched in place rather than round-tripped through the generated
// model, so fields not present on that type (e.g. grafanaSql, which buildQuery
// reads via its own wrapper) and empty slices that omitempty would drop
// survive the clone unchanged.
func cloneQueryWithResources(query backend.DataQuery, resources []dataquery.AzureMonitorResource, sub, region *string) (backend.DataQuery, error) {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(query.JSON, &raw); err != nil {
		return backend.DataQuery{}, err
	}
	var azRaw map[string]json.RawMessage
	if err := json.Unmarshal(raw["azureMonitor"], &azRaw); err != nil {
		return backend.DataQuery{}, fmt.Errorf("failed to decode the azureMonitor query object: %w", err)
	}

	resJSON, err := json.Marshal(resources)
	if err != nil {
		return backend.DataQuery{}, err
	}
	azRaw["resources"] = resJSON
	if region != nil {
		regionJSON, err := json.Marshal(*region)
		if err != nil {
			return backend.DataQuery{}, err
		}
		azRaw["region"] = regionJSON
	}
	azJSON, err := json.Marshal(azRaw)
	if err != nil {
		return backend.DataQuery{}, err
	}
	raw["azureMonitor"] = azJSON
	if sub != nil {
		subJSON, err := json.Marshal(*sub)
		if err != nil {
			return backend.DataQuery{}, err
		}
		raw["subscription"] = subJSON
	}

	copyJSON, err := json.Marshal(raw)
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
func fanOutByResource(query backend.DataQuery, model dataquery.AzureMonitorQuery) ([]backend.DataQuery, error) {
	az := model.AzureMonitor
	if az == nil || len(az.Resources) <= 1 {
		return []backend.DataQuery{query}, nil
	}

	queries := make([]backend.DataQuery, 0, len(az.Resources))
	for _, resource := range az.Resources {
		// Use the resource's own subscription and region so the ARM URL and
		// query parameters target the correct location when resources span
		// multiple subscriptions or regions. Resources without explicit values
		// keep the query-level defaults (nil leaves the cloned model unchanged).
		var sub *string
		if resource.Subscription != nil && *resource.Subscription != "" {
			sub = resource.Subscription
		}
		var region *string
		if resource.Region != nil && *resource.Region != "" {
			region = resource.Region
		}
		queryCopy, err := cloneQueryWithResources(query, []dataquery.AzureMonitorResource{resource}, sub, region)
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
func (e *AzureMonitorDatasource) buildQueriesForBatch(query backend.DataQuery, queryJSONModel dataquery.AzureMonitorQuery, dsInfo types.DatasourceInfo) ([]*types.AzureMonitorQuery, error) {
	azJSONModel := queryJSONModel.AzureMonitor

	if _, err := buildDimensionFilterString(azJSONModel); err != nil {
		return nil, err
	}

	// Determine the query-level defaults for subscription and region.
	defaultSub := dsInfo.Settings.SubscriptionId
	if queryJSONModel.Subscription != nil && *queryJSONModel.Subscription != "" {
		defaultSub = *queryJSONModel.Subscription
	} else {
		// The frontend is expected to set a subscription on every query, so this
		// fallback to the datasource-level default should not normally be hit.
		e.Logger.Debug("batch query did not specify a subscription; falling back to the datasource default", "refID", query.RefID)
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
		// buildQuery only reads the query-level region; when the region is set
		// solely on the resource entry, carry it over so batch grouping targets
		// the regional endpoint instead of the global one.
		if q.Params.Get("region") == "" && len(azJSONModel.Resources) == 1 {
			if r := azJSONModel.Resources[0].Region; r != nil && *r != "" {
				q.Params.Set("region", *r)
			}
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
		// buildQuery only reads the query-level region; when the shared region
		// comes from the resource entries, carry it over so batch grouping
		// targets the regional endpoint instead of the global one.
		if q.Params.Get("region") == "" && orderedKeys[0].region != "" {
			q.Params.Set("region", orderedKeys[0].region)
		}
		return []*types.AzureMonitorQuery{q}, nil
	}

	// Build one AzureMonitorQuery per (subscription, region) group.
	var result []*types.AzureMonitorQuery
	for _, key := range orderedKeys {
		sub, region := key.sub, key.region
		queryCopy, err := cloneQueryWithResources(query, groupedResources[key], &sub, &region)
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

// applyLegacyDimensions folds the deprecated top-level dimension/dimensionFilter
// fields into each query's Dimensions so the batch filter honours them, matching
// buildQuery's legacy branch on the single-resource path. The batch filter is
// derived solely from Dimensions (via dimensionFilterKey), which only carries the
// modern dimensionFilters, so without this the legacy fields would be silently
// dropped for batch queries. Applies only when dimensionFilters is empty and both
// legacy fields are set, mirroring the single-resource condition exactly.
func applyLegacyDimensions(queries []*types.AzureMonitorQuery, model dataquery.AzureMonitorQuery) {
	az := model.AzureMonitor
	if az == nil || len(az.DimensionFilters) > 0 {
		return
	}
	dimension := ""
	if az.Dimension != nil {
		dimension = strings.TrimSpace(*az.Dimension)
	}
	dimensionFilter := ""
	if az.DimensionFilter != nil {
		dimensionFilter = strings.TrimSpace(*az.DimensionFilter)
	}
	if dimension == "" || dimensionFilter == "" || dimension == "None" {
		return
	}

	op := "eq"
	for _, q := range queries {
		if len(q.Dimensions) == 0 {
			// Build a fresh slice per query so no two queries share backing state.
			q.Dimensions = []dataquery.AzureMetricDimension{
				{Dimension: &dimension, Operator: &op, Filters: []string{dimensionFilter}},
			}
		}
	}
}

// executeBatchTimeSeriesQuery groups all queries into Metrics Batch API requests,
// executes them in parallel, and distributes the resulting frames back to their
// original RefIDs. Queries that cannot use the batch API (custom metrics, Guest
// OS metrics) are executed individually via the legacy ARM endpoint.
// batchClient is the dedicated data-plane HTTP client for batch requests, so
// that requests to the regional data-plane endpoints (derived from
// dataPlaneURL, e.g. *.metrics.monitor.azure.com) carry a token scoped to that
// audience rather than the ARM audience. The caller (ExecuteTimeSeriesQuery)
// resolves both from the batch metrics datasource service and falls back to
// the legacy ARM path when the service is not configured.
func (e *AzureMonitorDatasource) executeBatchTimeSeriesQuery(ctx context.Context, originalQueries []backend.DataQuery, dsInfo types.DatasourceInfo, client *http.Client, batchClient *http.Client, dataPlaneURL string) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()

	armURL := dsInfo.Routes[types.RouteAzureMonitor].URL

	// Separate batchable from non-batchable (custom namespace / Guest OS) queries.
	// Non-batchable queries are executed individually via the legacy ARM endpoint.
	// parsedQuery pairs a query with its decoded model so query.JSON is
	// unmarshaled once here and reused by the batch helpers below.
	type parsedQuery struct {
		query backend.DataQuery
		model dataquery.AzureMonitorQuery
	}
	var batchableQueries []parsedQuery
	for _, query := range originalQueries {
		var model dataquery.AzureMonitorQuery
		if err := json.Unmarshal(query.JSON, &model); err != nil {
			result.Responses[query.RefID] = backend.ErrorResponseWithErrorSource(err)
			continue
		}
		if !isBatchableModel(model) {
			subQueries, err := fanOutByResource(query, model)
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
			batchableQueries = append(batchableQueries, parsedQuery{query: query, model: model})
		}
	}

	// Build all batchable queries, splitting multi-resource queries by
	// (subscription, region) so that each AzureMonitorQuery targets a single
	// batch endpoint.
	var azureQueries []*types.AzureMonitorQuery
	for _, bq := range batchableQueries {
		splitQueries, err := e.buildQueriesForBatch(bq.query, bq.model, dsInfo)
		if err != nil {
			result.Responses[bq.query.RefID] = backend.ErrorResponseWithErrorSource(err)
			continue
		}
		applyLegacyDimensions(splitQueries, bq.model)
		azureQueries = append(azureQueries, splitQueries...)
	}

	if len(azureQueries) == 0 {
		return result, nil
	}

	// Group into batches and execute all in parallel.
	batches := createBatches(groupQueriesForBatch(azureQueries), dataPlaneURL)
	batchResults := executeBatchRequests(ctx, batches, batchClient)

	// For each batch: distribute frames to their RefID responses, then attribute
	// any error (HTTP failure or per-metric parse error) to the affected queries.
	// Frames from successful batches are preserved even when another batch fails.
	azurePortalURL := dsInfo.Routes[types.RouteAzurePortal].URL
	for _, br := range batchResults {
		if br.Err != nil {
			// HTTP-level failure: attribute the error to every query in the batch.
			for _, q := range br.Batch.Queries {
				attachErr(result, q.RefID, br.Err)
			}
			continue
		}

		// Resolve the subscription display name (cached, one lookup per
		// subscription) so {{subscription}} in legends renders the friendly name
		// exactly like the legacy ARM path. All queries in a batch share one
		// subscription, so resolving per batch is sufficient. A failed lookup
		// fails the batch's queries, matching executeQuery on the legacy path.
		subscription, err := e.retrieveSubscriptionDetails(client, ctx, br.Batch.Key.Subscription,
			dsInfo.Routes[types.RouteAzureMonitor].URL, dsInfo.DatasourceID, dsInfo.OrgID, dsInfo.Credentials)
		if err != nil {
			for _, q := range br.Batch.Queries {
				attachErr(result, q.RefID, err)
			}
			continue
		}

		// Successful HTTP response: parse and distribute frames.
		frames, parseErr := parseBatchResponse(br, azurePortalURL, subscription, e.Logger)
		for _, frame := range frames {
			dr := result.Responses[frame.RefID]
			dr.Frames = append(dr.Frames, frame)
			result.Responses[frame.RefID] = dr
		}
		if parseErr != nil {
			// Per-metric or parse error: surface to every query in the batch so
			// users see it in the Grafana UI rather than it being silently dropped.
			for _, q := range br.Batch.Queries {
				attachErr(result, q.RefID, parseErr)
			}
		}
		// Ensure every query in the batch has a response entry even when it
		// yielded no frames and no error (e.g. an empty timeseries for the
		// requested window), matching the legacy path which always assigns a
		// per-query response.
		for _, q := range br.Batch.Queries {
			if _, ok := result.Responses[q.RefID]; !ok {
				result.Responses[q.RefID] = backend.DataResponse{}
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

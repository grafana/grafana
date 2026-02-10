package metrics

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

const maxBatchSize = 50

// groupQueriesIntoBatches groups queries that can be batched together
// Queries are grouped by: region, subscription, namespace, metric names, time range, interval, aggregation, filter
func groupQueriesIntoBatches(queries []*types.AzureMonitorQuery) []*types.BatchQueryGroup {
	// Group queries by their batch key
	groupMap := make(map[string]*types.BatchQueryGroup)

	for _, query := range queries {
		// Generate a unique key for this batch group
		batchKey := generateBatchKey(query)

		group, exists := groupMap[batchKey]
		if !exists {
			// Create a new batch group
			group = &types.BatchQueryGroup{
				Region:       extractRegion(query),
				Subscription: query.Subscription,
				Namespace:    query.Params.Get("metricnamespace"),
				MetricNames:  []string{query.Params.Get("metricnames")},
				TimeRange:    query.TimeRange,
				Interval:     query.Params.Get("interval"),
				Aggregation:  query.Params.Get("aggregation"),
				Filter:       extractDimensionFilter(query),
				Top:          query.Params.Get("top"),
				OrderBy:      query.Params.Get("orderby"),
				ResourceIds:  []string{},
				Queries:      []*types.AzureMonitorQuery{},
			}
			groupMap[batchKey] = group
		}

		// Add resource IDs from this query
		resourceIds := extractResourceIdsFromQuery(query)
		for _, resourceId := range resourceIds {
			// Avoid duplicates
			if !contains(group.ResourceIds, resourceId) {
				group.ResourceIds = append(group.ResourceIds, resourceId)
			}
		}

		// Add the query to the group
		group.Queries = append(group.Queries, query)
	}

	// Split groups that exceed the batch size limit
	batches := []*types.BatchQueryGroup{}
	for _, group := range groupMap {
		if len(group.ResourceIds) <= maxBatchSize {
			batches = append(batches, group)
		} else {
			// Split into multiple batches
			splitBatches := splitBatchGroup(group)
			batches = append(batches, splitBatches...)
		}
	}

	return batches
}

// generateBatchKey creates a unique key for grouping queries
func generateBatchKey(query *types.AzureMonitorQuery) string {
	// Combine all the parameters that must match for batching
	parts := []string{
		extractRegion(query),
		query.Subscription,
		query.Params.Get("metricnamespace"),
		query.Params.Get("metricnames"),
		query.TimeRange.From.String(),
		query.TimeRange.To.String(),
		query.Params.Get("interval"),
		query.Params.Get("aggregation"),
		extractDimensionFilter(query),
		query.Params.Get("top"),
		query.Params.Get("orderby"),
	}

	combined := strings.Join(parts, "|")

	// Hash the combined string to create a consistent key
	hash := sha256.Sum256([]byte(combined))
	return hex.EncodeToString(hash[:])
}

// extractRegion extracts the region from a query
// In Azure Monitor, the region is typically stored in the query params or resource metadata
func extractRegion(query *types.AzureMonitorQuery) string {
	// Check if region is in query params
	if region := query.Params.Get("region"); region != "" {
		return region
	}

	// Extract from resource ID if available
	// Resource IDs don't contain region, so we need to get it from somewhere else
	// For now, return empty string which will use the global endpoint
	// In practice, this should be enhanced to fetch region from resource metadata
	return ""
}

// extractDimensionFilter extracts dimension filters from the query
func extractDimensionFilter(query *types.AzureMonitorQuery) string {
	// Check for $filter parameter
	if filter := query.Params.Get("$filter"); filter != "" {
		return filter
	}

	// Check for body filter (used in POST requests)
	if query.BodyFilter != "" {
		return query.BodyFilter
	}

	return ""
}

// extractResourceIdsFromQuery extracts all resource IDs from a query
func extractResourceIdsFromQuery(query *types.AzureMonitorQuery) []string {
	resourceIds := []string{}

	// Extract from Resources map
	for resourceId := range query.Resources {
		// Resource IDs in the map are lowercased, but we need the original case
		// We need to reconstruct the proper resource ID
		// For now, use the key directly (it should be the full resource ID)
		if resourceId != "" {
			resourceIds = append(resourceIds, resourceId)
		}
	}

	// If no resources in map, try to extract from URL
	if len(resourceIds) == 0 {
		resourceId := extractResourceIDFromURL(query.URL)
		if resourceId != "" {
			resourceIds = append(resourceIds, resourceId)
		}
	}

	return resourceIds
}

// extractResourceIDFromURL extracts the resource ID from a metrics URL
func extractResourceIDFromURL(url string) string {
	// URL format: /subscriptions/{sub}/resourceGroups/{rg}/.../providers/microsoft.insights/metrics
	if idx := strings.Index(url, "/providers/microsoft.insights/metrics"); idx > 0 {
		return url[:idx]
	}
	if idx := strings.Index(url, "/providers/Microsoft.Insights/metrics"); idx > 0 {
		return url[:idx]
	}
	return ""
}

// splitBatchGroup splits a batch group that exceeds the maxBatchSize into multiple groups
func splitBatchGroup(group *types.BatchQueryGroup) []*types.BatchQueryGroup {
	batches := []*types.BatchQueryGroup{}

	for i := 0; i < len(group.ResourceIds); i += maxBatchSize {
		end := i + maxBatchSize
		if end > len(group.ResourceIds) {
			end = len(group.ResourceIds)
		}

		batch := &types.BatchQueryGroup{
			Region:       group.Region,
			Subscription: group.Subscription,
			Namespace:    group.Namespace,
			MetricNames:  group.MetricNames,
			TimeRange:    group.TimeRange,
			Interval:     group.Interval,
			Aggregation:  group.Aggregation,
			Filter:       group.Filter,
			Top:          group.Top,
			OrderBy:      group.OrderBy,
			ResourceIds:  group.ResourceIds[i:end],
			Queries:      filterQueriesByResourceIds(group.Queries, group.ResourceIds[i:end]),
		}

		batches = append(batches, batch)
	}

	return batches
}

// filterQueriesByResourceIds filters queries to only include those that reference the given resource IDs
func filterQueriesByResourceIds(queries []*types.AzureMonitorQuery, resourceIds []string) []*types.AzureMonitorQuery {
	filtered := []*types.AzureMonitorQuery{}

	for _, query := range queries {
		queryResourceIds := extractResourceIdsFromQuery(query)
		for _, qrId := range queryResourceIds {
			if contains(resourceIds, qrId) {
				filtered = append(filtered, query)
				break
			}
		}
	}

	return filtered
}

// partitionQueries separates queries into batchable and non-batchable
func partitionQueries(queries []*types.AzureMonitorQuery) ([]*types.AzureMonitorQuery, []*types.AzureMonitorQuery) {
	batchable := []*types.AzureMonitorQuery{}
	nonBatchable := []*types.AzureMonitorQuery{}

	for _, query := range queries {
		if isBatchableQuery(query) {
			batchable = append(batchable, query)
		} else {
			nonBatchable = append(nonBatchable, query)
		}
	}

	return batchable, nonBatchable
}

// contains checks if a slice contains a string
func contains(slice []string, item string) bool {
	// Case-insensitive comparison for resource IDs
	itemLower := strings.ToLower(item)
	for _, s := range slice {
		if strings.ToLower(s) == itemLower {
			return true
		}
	}
	return false
}

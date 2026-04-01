package metrics

import (
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

// batchGroupKey holds the parameters that must be identical for queries to be batched together.
// Queries sharing a key can be combined into a single Metrics Batch API request.
type batchGroupKey struct {
	Subscription string
	Region       string
	Namespace    string
	MetricNames  string
	From         string
	To           string
	Interval     string
	Aggregation  string
	DimFilter    string
	Top          string
}

// BatchQueryGroup is a set of queries sharing common parameters that can be executed
// as a single batch request to the Azure Monitor Metrics Batch API.
type BatchQueryGroup struct {
	Key     batchGroupKey
	Queries []*types.AzureMonitorQuery
}

// groupQueriesForBatch groups queries by their common parameters.
// The order of groups follows the first appearance of each unique key.
func groupQueriesForBatch(queries []*types.AzureMonitorQuery) []BatchQueryGroup {
	groups := make(map[batchGroupKey]*BatchQueryGroup)
	var orderedKeys []batchGroupKey

	for _, query := range queries {
		key := batchGroupKey{
			Subscription: query.Subscription,
			Region:       query.Params.Get("region"),
			Namespace:    query.Params.Get("metricnamespace"),
			MetricNames:  query.Params.Get("metricnames"),
			From:         query.TimeRange.From.UTC().Format(time.RFC3339),
			To:           query.TimeRange.To.UTC().Format(time.RFC3339),
			Interval:     query.Params.Get("interval"),
			Aggregation:  query.Params.Get("aggregation"),
			DimFilter:    dimensionFilterKey(query),
			Top:          query.Params.Get("top"),
		}

		if _, exists := groups[key]; !exists {
			groups[key] = &BatchQueryGroup{Key: key}
			orderedKeys = append(orderedKeys, key)
		}
		groups[key].Queries = append(groups[key].Queries, query)
	}

	result := make([]BatchQueryGroup, 0, len(orderedKeys))
	for _, key := range orderedKeys {
		result = append(result, *groups[key])
	}
	return result
}

const maxBatchSize = 50

// Batch represents a single POST request to the Metrics Batch API.
// It contains at most maxBatchSize resource IDs and the original queries
// needed to map response values back to their RefIDs.
type Batch struct {
	Key         batchGroupKey
	ResourceIDs []string
	Queries     []*types.AzureMonitorQuery
}

// createBatches splits each group into one or more Batch objects so that no
// batch contains more than maxBatchSize resource IDs.
func createBatches(groups []BatchQueryGroup) []Batch {
	var batches []Batch
	for _, group := range groups {
		ids := resourceIDsForGroup(group)
		for i := 0; i < len(ids); i += maxBatchSize {
			end := i + maxBatchSize
			if end > len(ids) {
				end = len(ids)
			}
			chunk := ids[i:end]

			// Include only the queries that own at least one resource in this chunk.
			// chunk is sorted, so use binary search instead of building a map.
			var chunkQueries []*types.AzureMonitorQuery
			for _, query := range group.Queries {
				for resourceID := range query.Resources {
					if inSortedSlice(chunk, resourceID) {
						chunkQueries = append(chunkQueries, query)
						break
					}
				}
			}

			batches = append(batches, Batch{
				Key:         group.Key,
				ResourceIDs: chunk,
				Queries:     chunkQueries,
			})
		}
	}
	return batches
}

// resourceIDsForGroup returns the deduplicated, sorted list of resource IDs
// from all queries in the group.
func resourceIDsForGroup(group BatchQueryGroup) []string {
	seen := make(map[string]bool)
	var ids []string
	for _, query := range group.Queries {
		for resourceID := range query.Resources {
			if !seen[resourceID] {
				seen[resourceID] = true
				ids = append(ids, resourceID)
			}
		}
	}
	sort.Strings(ids)
	return ids
}

// inSortedSlice reports whether target is present in the sorted slice s,
// using binary search. Callers must ensure s is sorted in ascending order.
func inSortedSlice(s []string, target string) bool {
	i := sort.SearchStrings(s, target)
	return i < len(s) && s[i] == target
}

// dimensionFilterKey returns a stable string representation of the dimension filters
// on a query, suitable for use as a grouping key.
func dimensionFilterKey(query *types.AzureMonitorQuery) string {
	if len(query.Dimensions) == 0 {
		return ""
	}

	parts := make([]string, 0, len(query.Dimensions))
	for _, dim := range query.Dimensions {
		parts = append(parts, types.ConstructFiltersString(dim))
	}
	sort.Strings(parts)
	return strings.Join(parts, " and ")
}

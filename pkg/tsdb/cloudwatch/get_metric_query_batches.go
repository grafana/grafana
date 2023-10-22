package cloudwatch

import (
	"regexp"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

// nonWordRegex is for spliting the expressions to just functions and ids
var nonWordRegex = regexp.MustCompile(`\W+`)

// getMetricQueryBatches separates queries into batches if necessary. Metric Insight queries cannot run together, and math expressions must be run
// with all the queries they reference.
func getMetricQueryBatches(queries []*models.CloudWatchQuery, logger log.Logger) [][]*models.CloudWatchQuery {
	metricInsightIndices := []int{}
	mathIndices := []int{}
	for i, query := range queries {
		switch query.GetGetMetricDataAPIMode() {
		case models.GMDApiModeSQLExpression:
			metricInsightIndices = append(metricInsightIndices, i)
		case models.GMDApiModeMathExpression:
			mathIndices = append(mathIndices, i)
		default:
		}
	}
	// We only need multiple batches if there are multiple metrics insight queries
	if len(metricInsightIndices) <= 1 {
		return [][]*models.CloudWatchQuery{queries}
	}

	logger.Debug("Separating queries into batches")
	// Map ids to their queries
	idToIndex := map[string]int{}
	for i, query := range queries {
		if query.Id != "" {
			idToIndex[query.Id] = i
		}
	}

	// Find and track which queries are referenced by math queries
	queryReferences := make([][]int, len(queries))
	isReferenced := make([]bool, len(queries))
	for _, idx := range mathIndices {
		tokens := nonWordRegex.Split(queries[idx].Expression, -1)
		references := []int{}
		for _, token := range tokens {
			ref, found := idToIndex[token]
			if found {
				references = append(references, ref)
				isReferenced[ref] = true
			}
		}
		queryReferences[idx] = references
	}

	// Create a new batch for every query not used in another query
	batches := [][]*models.CloudWatchQuery{}
	for i, used := range isReferenced {
		if !used {
			batches = append(batches, getReferencedQueries(queries, queryReferences, i))
		}
	}
	return batches
}

// getReferencedQueries gets all the queries referenced by startQuery and its referenced queries
func getReferencedQueries(queries []*models.CloudWatchQuery, queryReferences [][]int, startQuery int) []*models.CloudWatchQuery {
	usedQueries := make([]bool, len(queries))
	batch := []*models.CloudWatchQuery{}

	queriesToAdd := []int{startQuery}
	usedQueries[startQuery] = true
	for i := 0; i < len(queriesToAdd); i++ {
		batch = append(batch, queries[queriesToAdd[i]])
		for _, queryIdx := range queryReferences[queriesToAdd[i]] {
			if !usedQueries[queryIdx] {
				usedQueries[queryIdx] = true
				queriesToAdd = append(queriesToAdd, queryIdx)
			}
		}
	}
	return batch
}

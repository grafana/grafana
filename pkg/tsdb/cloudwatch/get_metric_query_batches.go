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
	// We only need multiple batches if there are multiple metrics insight queries
	if !haveMultipleMetricInsights(queries) {
		return [][]*models.CloudWatchQuery{queries}
	}

	logger.Debug("Separating queries into batches")

	// let's deal with IDs and pass them around, then use this following map to convert them back to queries at the end
	queryLookupById := make(map[string]*models.CloudWatchQuery) // maybe don't need pointers everywhere
	for _, q := range queries {
		queryLookupById[q.Id] = q
	}

	var mathQueries []string
	for _, query := range queries {
		if query.GetGetMetricDataAPIMode() == models.GMDApiModeMathExpression {
			mathQueries = append(mathQueries, query.Id)
		}
	}

	// Find and track which queries are referenced by math queries
	groupOfReferencedQueries, isReferenced := findQueriesReferencedByMathQueries(mathQueries, queryLookupById)

	// root query
	// Create a new batch for every query not used in another query
	batches := [][]*models.CloudWatchQuery{}
	for _, query := range queries {
		if _, ok := isReferenced[query.Id]; !ok {
			batches = append(batches, getReferencedQueries(queryLookupById, groupOfReferencedQueries, query.Id))
		}
	}
	return batches
}

func findQueriesReferencedByMathQueries(mathQueries []string, queryLookupById map[string]*models.CloudWatchQuery) (map[string][]string, map[string]bool) {
	groupOfReferencedQueries := make(map[string][]string)
	isReferenced := make(map[string]bool)
	for _, mathQuery := range mathQueries {
		substrings := nonWordRegex.Split(queryLookupById[mathQuery].Expression, -1) // i think here we could have instead stored the query in mathQueries?
		references := []string{}
		for _, id := range substrings {
			_, found := queryLookupById[id]
			if found {
				references = append(references, id)
				isReferenced[id] = true
			}
		}
		groupOfReferencedQueries[mathQuery] = references
	}
	return groupOfReferencedQueries, isReferenced
}

// getReferencedQueries gets all the queries referenced by startQuery and its referenced queries
func getReferencedQueries(queries map[string]*models.CloudWatchQuery, groupOfReferencedQueries map[string][]string, rootQueryId string) []*models.CloudWatchQuery {
	usedQueries := make(map[string]bool)
	batch := []*models.CloudWatchQuery{}

	queriesToAdd := []string{rootQueryId}
	usedQueries[rootQueryId] = true
	for i := 0; i < len(queriesToAdd); i++ {
		currentQueryId := queriesToAdd[i]
		batch = append(batch, queries[currentQueryId])
		for _, referencedQueryId := range groupOfReferencedQueries[currentQueryId] {
			if !usedQueries[referencedQueryId] {
				usedQueries[referencedQueryId] = true
				queriesToAdd = append(queriesToAdd, referencedQueryId)
			}
		}
	}
	return batch
}

func haveMultipleMetricInsights(queries []*models.CloudWatchQuery) bool {
	metricInsightsCount := 0
	for _, query := range queries {
		if query.GetGetMetricDataAPIMode() == models.GMDApiModeSQLExpression {
			metricInsightsCount++
		}
		if metricInsightsCount > 1 {
			return true
		}
	}
	return false
}

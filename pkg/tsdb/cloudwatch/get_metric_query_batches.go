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
	// let's deal with IDs and pass them around, then use this following map to convert them back to queries at the end
	queriesMap := make(map[string]*models.CloudWatchQuery) // maybe don't need pointers everywhere
	for _, q := range queries {
		queriesMap[q.Id] = q
	}

	metricInsightIndices := []int{}
	mathQueries := make(map[string]bool)
	for i, query := range queries {
		switch query.GetGetMetricDataAPIMode() {
		case models.GMDApiModeSQLExpression:
			metricInsightIndices = append(metricInsightIndices, i)
		case models.GMDApiModeMathExpression:
			mathQueries[query.Id] = true
		default:
		}
	}
	// We only need multiple batches if there are multiple metrics insight queries
	if len(metricInsightIndices) <= 1 {
		return [][]*models.CloudWatchQuery{queries}
	}

	logger.Debug("Separating queries into batches")

	// Find and track which queries are referenced by math queries
	groupOfReferencedQueries := make(map[string][]string)
	isReferenced := make(map[string]bool)
	for mathQueryId := range mathQueries {
		tokens := nonWordRegex.Split(queriesMap[mathQueryId].Expression, -1)
		references := []string{}
		for _, token := range tokens {
			_, found := queriesMap[token]
			if found {
				references = append(references, token)
				isReferenced[token] = true
			}
		}
		groupOfReferencedQueries[mathQueryId] = references
	}

	// root query
	// Create a new batch for every query not used in another query
	batches := [][]*models.CloudWatchQuery{}
	for _, query := range queries {
		if _, ok := isReferenced[query.Id]; !ok {
			batches = append(batches, getReferencedQueries(queriesMap, groupOfReferencedQueries, query.Id))
		}
	}
	return batches
}

// getReferencedQueries gets all the queries referenced by startQuery and its referenced queries
func getReferencedQueries(queries map[string]*models.CloudWatchQuery, queryReferences map[string][]string, rootQueryId string) []*models.CloudWatchQuery {
	usedQueries := make(map[string]bool)
	batch := []*models.CloudWatchQuery{}

	queriesToAdd := []string{rootQueryId}
	usedQueries[rootQueryId] = true
	for i := 0; i < len(queriesToAdd); i++ {
		currentQueryId := queriesToAdd[i]
		batch = append(batch, queries[currentQueryId])
		for _, referencedQueryId := range queryReferences[currentQueryId] {
			if !usedQueries[referencedQueryId] {
				usedQueries[referencedQueryId] = true
				queriesToAdd = append(queriesToAdd, referencedQueryId)
			}
		}
	}
	return batch
}

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

	queryLookupById, mathQueries := initializeQueryLookupAndMathQueries(queries)

	queriesReferencedByMathQueries, queriesWhichAreReferenced := getQueriesReferencedByMathQueries(mathQueries, queryLookupById)

	return createGroupsByQueriesNotReferencedInAnotherQuery(queryLookupById, queriesWhichAreReferenced, queriesReferencedByMathQueries)
}

func initializeQueryLookupAndMathQueries(queries []*models.CloudWatchQuery) (map[string]*models.CloudWatchQuery, []string) {
	queryLookupById := make(map[string]*models.CloudWatchQuery)
	for _, q := range queries {
		queryLookupById[q.Id] = q
	}

	var mathQueries []string
	for _, query := range queries {
		if query.GetGetMetricDataAPIMode() == models.GMDApiModeMathExpression {
			mathQueries = append(mathQueries, query.Id)
		}
	}
	return queryLookupById, mathQueries
}

func createGroupsByQueriesNotReferencedInAnotherQuery(queries map[string]*models.CloudWatchQuery,
	queriesWhichAreReferenced map[string]bool, groupOfReferencedQueries map[string][]string) [][]*models.CloudWatchQuery {
	batches := [][]*models.CloudWatchQuery{}
	for _, query := range queries {
		if _, ok := queriesWhichAreReferenced[query.Id]; !ok {
			batches = append(batches, getReferencedQueries(queries, groupOfReferencedQueries, query.Id))
		}
	}
	return batches
}

func getQueriesReferencedByMathQueries(mathQueries []string, queryLookupById map[string]*models.CloudWatchQuery) (map[string][]string, map[string]bool) {
	queriesReferencedByMathQueries := make(map[string][]string)
	isReferenced := make(map[string]bool)
	for _, mathQuery := range mathQueries {
		substrings := nonWordRegex.Split(queryLookupById[mathQuery].Expression, -1) // i think here we could have instead stored the query in mathQueries?
		for _, id := range substrings {
			_, found := queryLookupById[id]
			if found {
				queriesReferencedByMathQueries[mathQuery] = append(queriesReferencedByMathQueries[mathQuery], id)
				isReferenced[id] = true
			}
		}
	}
	return queriesReferencedByMathQueries, isReferenced
}

// getReferencedQueries gets all the queries referenced by rootQuery and its referenced queries
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

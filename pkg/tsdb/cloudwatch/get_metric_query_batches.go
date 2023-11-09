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
	if !haveMultipleMetricInsightsQueries(queries) {
		return [][]*models.CloudWatchQuery{queries}
	}

	logger.Debug("Separating queries into batches")

	idToQuery, mathQueries := initializeQuerySetAndMathQueries(queries)

	queriesReferencedByMathQueries, referencedQueries := getQueriesReferencedByMathQueries(mathQueries, idToQuery)

	batches := [][]*models.CloudWatchQuery{}
	for _, query := range queries {
		if _, ok := referencedQueries[query.Id]; !ok {
			batches = append(batches, getBatch(query.Id, queriesReferencedByMathQueries, idToQuery))
		}
	}
	return batches
}

func initializeQuerySetAndMathQueries(queries []*models.CloudWatchQuery) (map[string]*models.CloudWatchQuery, []string) {
	idToQuery := make(map[string]*models.CloudWatchQuery, len(queries))
	for _, q := range queries {
		idToQuery[q.Id] = q
	}

	var mathQueries []string
	for _, query := range queries {
		if query.GetGetMetricDataAPIMode() == models.GMDApiModeMathExpression {
			mathQueries = append(mathQueries, query.Id)
		}
	}

	return idToQuery, mathQueries
}

func getQueriesReferencedByMathQueries(mathQueries []string, idToQuery map[string]*models.CloudWatchQuery) (map[string][]string, map[string]bool) {
	queryReferences := make(map[string][]string)
	isReferenced := make(map[string]bool)
	for _, mathQuery := range mathQueries {
		substrings := nonWordRegex.Split(idToQuery[mathQuery].Expression, -1)
		for _, id := range substrings {
			_, found := idToQuery[id]
			if found {
				queryReferences[mathQuery] = append(queryReferences[mathQuery], id)
				isReferenced[id] = true
			}
		}
	}
	return queryReferences, isReferenced
}

// getBatch gets all the queries that should be included in the same batch as the start query. The start query is also included in the response.
// idToQuery is a map of the query id to the actual query
func getBatch(startQueryId string, queryReferences map[string][]string, idToQuery map[string]*models.CloudWatchQuery) []*models.CloudWatchQuery {
	connectedQueryIds := getConnectedQueriesIds(startQueryId, queryReferences)

	batch := make([]*models.CloudWatchQuery, 0, len(connectedQueryIds))

	// map query ids to the actual queries
	for _, id := range connectedQueryIds {
		batch = append(batch, idToQuery[id])
	}

	return batch
}

// getConnectedQueriesIds does a breadth-first search to find all the query ids connected to the start query id by references. The start query id is also returned in the response.
func getConnectedQueriesIds(startQueryId string, queryReferences map[string][]string) []string {
	visited := map[string]bool{startQueryId: true}
	queriesToReturn := []string{}

	queriesToVisit := []string{startQueryId}
	for i := 0; i < len(queriesToVisit); i++ {
		currentQueryId := queriesToVisit[i]
		queriesToReturn = append(queriesToReturn, currentQueryId)
		for _, queryRefId := range queryReferences[currentQueryId] {
			if !visited[queryRefId] {
				visited[queryRefId] = true
				queriesToVisit = append(queriesToVisit, queryRefId) // commenting out this line doesn't break any tests, TODO: write a test
			}
		}
	}
	return queriesToReturn
}

func haveMultipleMetricInsightsQueries(queries []*models.CloudWatchQuery) bool {
	count := 0
	for _, query := range queries {
		if query.GetGetMetricDataAPIMode() == models.GMDApiModeSQLExpression {
			count++
		}
		if count > 1 {
			return true
		}
	}
	return false
}

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
	if !hasMultipleMetricInsights(queries) {
		return [][]*models.CloudWatchQuery{queries}
	}

	logger.Debug("Separating queries into batches")

	idToQuery := make(map[string]*models.CloudWatchQuery, len(queries))
	for _, q := range queries {
		idToQuery[q.Id] = q
	}

	mathQueryIdToReferences, referencedQueries := getIdsReferencedByMathQueries(idToQuery)

	batches := [][]*models.CloudWatchQuery{}
	for _, query := range queries {
		// if a query is not referenced, then it is a "root" query
		if _, ok := referencedQueries[query.Id]; !ok {
			connectedIds := getConnectedIds(query.Id, mathQueryIdToReferences)

			batch := make([]*models.CloudWatchQuery, 0, len(connectedIds))
			// TODO: try passing around full queries
			// map query ids to the actual queries
			for _, id := range connectedIds {
				batch = append(batch, idToQuery[id])
			}
			batches = append(batches, batch)
		}
	}
	return batches
}

func getIdsReferencedByMathQueries(idToQuery map[string]*models.CloudWatchQuery) (map[string][]string, map[string]bool) {
	var mathQueries []*models.CloudWatchQuery
	for _, query := range idToQuery {
		if query.GetGetMetricDataAPIMode() == models.GMDApiModeMathExpression {
			mathQueries = append(mathQueries, query)
		}
	}

	mathQueryIdToReferences := make(map[string][]string)
	referencedQueries := make(map[string]bool)
	for _, mathQuery := range mathQueries {
		substrings := nonWordRegex.Split(mathQuery.Expression, -1)
		for _, id := range substrings {
			_, found := idToQuery[id]
			if found {
				mathQueryIdToReferences[mathQuery.Id] = append(mathQueryIdToReferences[mathQuery.Id], id)
				referencedQueries[id] = true
			}
		}
	}
	return mathQueryIdToReferences, referencedQueries
}

// getConnectedIds does a breadth-first search to find all the query ids connected to the root id by references. The root id is also returned in the response.
func getConnectedIds(rootId string, queryReferences map[string][]string) []string {
	visited := map[string]bool{rootId: true}
	queriesToReturn := []string{}

	queriesToVisit := []string{rootId}
	for i := 0; i < len(queriesToVisit); i++ {
		currentId := queriesToVisit[i]
		queriesToReturn = append(queriesToReturn, currentId)
		for _, queryRefId := range queryReferences[currentId] {
			if !visited[queryRefId] {
				visited[queryRefId] = true
				queriesToVisit = append(queriesToVisit, queryRefId)
			}
		}
	}
	return queriesToReturn
}

func hasMultipleMetricInsights(queries []*models.CloudWatchQuery) bool {
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

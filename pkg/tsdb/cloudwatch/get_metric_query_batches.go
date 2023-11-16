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

	// get query IDs which are referenced in math expressions
	mathQueryIdToReferences := getReferencedQueries(queries)

	rootQueries := getRootQueries(queries, mathQueryIdToReferences)

	batches := [][]*models.CloudWatchQuery{}
	for query := range rootQueries {
		batches = append(batches, getConnectedQueries(query, mathQueryIdToReferences))
	}
	return batches
}

func getRootQueries(queries []*models.CloudWatchQuery, mathQueryIdToReferences map[string][]*models.CloudWatchQuery) map[*models.CloudWatchQuery]bool {
	referencedQueries := make(map[string]bool)
	for _, referencedIds := range mathQueryIdToReferences {
		for _, query := range referencedIds {
			referencedQueries[query.Id] = true
		}
	}

	rootQueries := make(map[*models.CloudWatchQuery]bool)
	for _, query := range queries {
		// if a query is not referenced, then it is a "root" query
		if _, ok := referencedQueries[query.Id]; !ok {
			rootQueries[query] = true
		}
	}

	return rootQueries
}

// getReferencedQueries gets query IDs which are referenced in math expressions
func getReferencedQueries(queries []*models.CloudWatchQuery) map[string][]*models.CloudWatchQuery {
	// put queries into a set in order to facilitate lookup below
	idToQuery := make(map[string]*models.CloudWatchQuery, len(queries))
	for _, q := range queries {
		idToQuery[q.Id] = q
	}

	// set up list of math expression queries since below we loop over them to get what query IDs they reference
	var mathQueries []*models.CloudWatchQuery
	for _, query := range idToQuery {
		if query.GetGetMetricDataAPIMode() == models.GMDApiModeMathExpression {
			mathQueries = append(mathQueries, query)
		}
	}

	mathQueryIdToReferences := make(map[string][]*models.CloudWatchQuery)
	for _, mathQuery := range mathQueries {
		substrings := nonWordRegex.Split(mathQuery.Expression, -1)
		for _, id := range substrings {
			query, found := idToQuery[id]
			if found {
				mathQueryIdToReferences[mathQuery.Id] = append(mathQueryIdToReferences[mathQuery.Id], query)
			}
		}
	}
	return mathQueryIdToReferences
}

// getConnectedQueries does a breadth-first search to find all the query ids connected to the root id by references. The root id is also returned in the response.
func getConnectedQueries(root *models.CloudWatchQuery, queryReferences map[string][]*models.CloudWatchQuery) []*models.CloudWatchQuery {
	visited := map[string]bool{root.Id: true}
	queriesToReturn := []*models.CloudWatchQuery{}

	queriesToVisit := []*models.CloudWatchQuery{root}
	for i := 0; i < len(queriesToVisit); i++ {
		currentQuery := queriesToVisit[i]
		queriesToReturn = append(queriesToReturn, currentQuery)
		for _, queryRef := range queryReferences[currentQuery.Id] {
			if !visited[queryRef.Id] {
				visited[queryRef.Id] = true
				queriesToVisit = append(queriesToVisit, queryRef)
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

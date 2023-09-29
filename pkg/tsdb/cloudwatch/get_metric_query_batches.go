package cloudwatch

import (
	"regexp"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

var nonWordRegex = regexp.MustCompile(`\W+`)

func getMetricQueryBatches(queries []*models.CloudWatchQuery, logger log.Logger) [][]*models.CloudWatchQuery {
	metricInsightIndices := []int{}
	mathIndices := []int{}
	for i, query := range queries {
		switch query.GetGetMetricDataAPIMode() {
		case models.GMDApiModeSQLExpression:
			metricInsightIndices = append(metricInsightIndices, i)
		case models.GMDApiModeMathExpression:
			mathIndices = append(mathIndices, i)
		}
	}
	// We only need multiple batches if there are multiple metrics insight queries
	if len(metricInsightIndices) <= 1 {
		return [][]*models.CloudWatchQuery{queries}
	}

	batches := [][]*models.CloudWatchQuery{}
	idToIndex := map[string]int{}
	for i, query := range queries {
		if query.Id != "" {
			idToIndex[query.Id] = i
		}
	}

	// Find which queries are referenced by a math query
	queryReferences := make([][]int, len(queries))
	idReferenced := make([]bool, len(queries))
	for _, idx := range mathIndices {
		tokens := nonWordRegex.Split(queries[idx].Expression, -1)
		references := []int{}
		for _, token := range tokens {
			ref, found := idToIndex[token]
			if found {
				references = append(references, ref)
				idReferenced[ref] = true
			}
		}
		queryReferences[idx] = references
	}

	// Create a new batch for every query not used in another query
	for i, used := range idReferenced {
		if !used {
			batches = append(batches, getReferencedQueries(queries, idToIndex, queryReferences, i))
		}
	}
	return batches
}

func getReferencedQueries(queries []*models.CloudWatchQuery, idToIndex map[string]int, queryReferences [][]int, startQuery int) []*models.CloudWatchQuery {
	usedQueries := make([]bool, len(queries))
	batch := []*models.CloudWatchQuery{}
	queriesToAdd := []int{startQuery}
	usedQueries[startQuery] = true
	for i := 0; i < len(queriesToAdd); i++ {
		batch = append(batch, queries[queriesToAdd[i]])
		for _, query := range queryReferences[queriesToAdd[i]] {
			if !usedQueries[query] {
				usedQueries[query] = true
				queriesToAdd = append(queriesToAdd, query)
			}
		}
	}
	return batch
}

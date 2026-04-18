package queryhistory

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
)

func TestIntegrationEnforceRowLimitInQueryHistory(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testScenarioWithQueryInQueryHistory(t, "Enforce limit for query_history",
		func(t *testing.T, sc scenarioContext) {
			limit := 0
			rowsDeleted, err := sc.service.EnforceRowLimitInQueryHistory(context.Background(), limit, false)
			require.NoError(t, err)
			require.Equal(t, 1, rowsDeleted)
		})

	// In this scenario we have 2 starred queries and 1 not starred query
	testScenarioWithMultipleQueriesInQueryHistory(t, "Enforce limit for unstarred queries in query_history",
		func(t *testing.T, sc scenarioContext) {
			limit := 2
			rowsDeleted, err := sc.service.EnforceRowLimitInQueryHistory(context.Background(), limit, false)
			require.NoError(t, err)
			require.Equal(t, 1, rowsDeleted)
		})

	// In this scenario we have 2 starred queries and 1 not starred query
	testScenarioWithMultipleQueriesInQueryHistory(t, "Enforce limit for stars in query_history_star",
		func(t *testing.T, sc scenarioContext) {
			limit := 1
			rowsDeleted, err := sc.service.EnforceRowLimitInQueryHistory(context.Background(), limit, true)
			require.NoError(t, err)
			require.Equal(t, 1, rowsDeleted)
		})

	// In this scenario we have 2 starred queries and 1 not starred query
	testScenarioWithMultipleQueriesInQueryHistory(t, "Enforce limit for stars in query_history_star",
		func(t *testing.T, sc scenarioContext) {
			limit := 0
			rowsDeleted, err := sc.service.EnforceRowLimitInQueryHistory(context.Background(), limit, true)
			require.NoError(t, err)
			require.Equal(t, 2, rowsDeleted)
		})
}

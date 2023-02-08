package queryhistory

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/web"
)

func TestIntegrationDeleteStaleQueryFromQueryHistory(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testScenarioWithQueryInQueryHistory(t, "Stale query history can be deleted",
		func(t *testing.T, sc scenarioContext) {
			olderThan := time.Now().Unix() + 60
			rowsDeleted, err := sc.service.DeleteStaleQueriesInQueryHistory(context.Background(), olderThan)
			require.NoError(t, err)
			require.Equal(t, 1, rowsDeleted)
		})

	testScenarioWithQueryInQueryHistory(t, "Stale single starred query history can not be deleted",
		func(t *testing.T, sc scenarioContext) {
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.starHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			olderThan := time.Now().Unix() + 60
			rowsDeleted, err := sc.service.DeleteStaleQueriesInQueryHistory(context.Background(), olderThan)
			require.NoError(t, err)
			require.Equal(t, 0, rowsDeleted)
		})

	testScenarioWithQueryInQueryHistory(t, "Not stale query history is not deleted",
		func(t *testing.T, sc scenarioContext) {
			olderThan := time.Now().Unix() - 60
			rowsDeleted, err := sc.service.DeleteStaleQueriesInQueryHistory(context.Background(), olderThan)
			require.NoError(t, err)
			require.Equal(t, 0, rowsDeleted)
		})

	// In this scenario we have 2 starred queries and 1 not starred query
	testScenarioWithMultipleQueriesInQueryHistory(t, "Stale starred query history can not be deleted",
		func(t *testing.T, sc scenarioContext) {
			olderThan := time.Now().Unix() + 60
			rowsDeleted, err := sc.service.DeleteStaleQueriesInQueryHistory(context.Background(), olderThan)
			require.NoError(t, err)
			require.Equal(t, 1, rowsDeleted)
		})
}

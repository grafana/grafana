//go:build integration
// +build integration

package queryhistory

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
)

func TestDeleteQueryFromQueryHistory(t *testing.T) {
	testScenarioWithQueryInQueryHistory(t, "When users tries to delete query in query history that does not exist, it should fail",
		func(t *testing.T, sc scenarioContext) {
			resp := sc.service.deleteHandler(sc.reqContext)
			require.Equal(t, 500, resp.Status())
		})

	testScenarioWithQueryInQueryHistory(t, "When users tries to delete query in query history that exists, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.deleteHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
		})

	testScenarioWithQueryInQueryHistory(t, "When users tries to delete query in query history that exists, it should also unstar it and succeed",
		func(t *testing.T, sc scenarioContext) {
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			// Star added query
			sc.service.starHandler(sc.reqContext)
			// Then delete it
			resp := sc.service.deleteHandler(sc.reqContext)
			// Check if query is still in query_history_star table
			err := sc.sqlStore.WithDbSession(context.Background(), func(dbSession *sqlstore.DBSession) error {
				exists, err := dbSession.Table("query_history_star").Where("user_id = ? AND query_uid = ?", sc.reqContext.SignedInUser.UserId, sc.initialResult.Result.UID).Exist()
				require.NoError(t, err)
				require.Equal(t, false, exists)
				return err
			})
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
		})
}

func TestDeleteStaleQueryFromQueryHistory(t *testing.T) {
	testScenarioWithQueryInQueryHistory(t, "Stale query history can be deleted",
		func(t *testing.T, sc scenarioContext) {
			olderThan := time.Now().Unix() + 60
			rowsDeleted, err := sc.service.DeleteStaleQueryHistory(context.Background(), olderThan)
			require.NoError(t, err)
			require.Equal(t, 1, rowsDeleted)
		})

	testScenarioWithQueryInQueryHistory(t, "Stale single starred query history can not be deleted",
		func(t *testing.T, sc scenarioContext) {
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.starHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			olderThan := time.Now().Unix() + 60
			rowsDeleted, err := sc.service.DeleteStaleQueryHistory(context.Background(), olderThan)
			require.NoError(t, err)
			require.Equal(t, 0, rowsDeleted)
		})

	testScenarioWithQueryInQueryHistory(t, "Not stale query history is not deleted",
		func(t *testing.T, sc scenarioContext) {
			olderThan := time.Now().Unix() - 60
			rowsDeleted, err := sc.service.DeleteStaleQueryHistory(context.Background(), olderThan)
			require.NoError(t, err)
			require.Equal(t, 0, rowsDeleted)
		})

	// In this scenario we have 2 starred queries and 1 not starred query
	testScenarioWithMultipleQueriesInQueryHistory(t, "Stale starred query history can not be deleted",
		func(t *testing.T, sc scenarioContext) {
			olderThan := time.Now().Unix() + 60
			rowsDeleted, err := sc.service.DeleteStaleQueryHistory(context.Background(), olderThan)
			require.NoError(t, err)
			require.Equal(t, 1, rowsDeleted)
		})
}

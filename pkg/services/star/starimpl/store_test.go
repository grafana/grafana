package starimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/star"
)

type getStore func(db.DB) store

func testIntegrationUserStarsDataAccess(t *testing.T, fn getStore) {
	t.Helper()

	t.Run("Testing User Stars Data Access", func(t *testing.T) {
		ss := db.InitTestDB(t)
		starStore := fn(ss)

		t.Run("Given saved star", func(t *testing.T) {
			cmd := star.StarDashboardCommand{
				DashboardID: 10,
				UserID:      12,
			}
			err := starStore.Insert(context.Background(), &cmd)
			require.NoError(t, err)

			t.Run("Get should return true when starred", func(t *testing.T) {
				query := star.IsStarredByUserQuery{UserID: 12, DashboardID: 10}
				isStarred, err := starStore.Get(context.Background(), &query)
				require.NoError(t, err)
				require.True(t, isStarred)
			})

			t.Run("Get should return false when not starred", func(t *testing.T) {
				query := star.IsStarredByUserQuery{UserID: 12, DashboardID: 12}
				isStarred, err := starStore.Get(context.Background(), &query)
				require.NoError(t, err)
				require.False(t, isStarred)
			})

			t.Run("List should return a list of size 1", func(t *testing.T) {
				query := star.GetUserStarsQuery{UserID: 12}
				result, err := starStore.List(context.Background(), &query)
				require.NoError(t, err)
				require.Equal(t, 1, len(result.UserStars))
			})

			t.Run("Delete should remove the star", func(t *testing.T) {
				deleteQuery := star.UnstarDashboardCommand{DashboardID: 10, UserID: 12}
				err := starStore.Delete(context.Background(), &deleteQuery)
				require.NoError(t, err)
				getQuery := star.IsStarredByUserQuery{UserID: 12, DashboardID: 10}
				isStarred, err := starStore.Get(context.Background(), &getQuery)
				require.NoError(t, err)
				require.False(t, isStarred)
			})
		})

		t.Run("DeleteByUser should remove the star for user", func(t *testing.T) {
			star1 := star.StarDashboardCommand{
				DashboardID: 10,
				UserID:      12,
			}
			err := starStore.Insert(context.Background(), &star1)
			require.NoError(t, err)
			star2 := star.StarDashboardCommand{
				DashboardID: 11,
				UserID:      12,
			}
			err = starStore.Insert(context.Background(), &star2)
			require.NoError(t, err)
			star3 := star.StarDashboardCommand{
				DashboardID: 11,
				UserID:      11,
			}
			err = starStore.Insert(context.Background(), &star3)
			require.NoError(t, err)
			err = starStore.DeleteByUser(context.Background(), 12)
			require.NoError(t, err)
			res, err := starStore.List(context.Background(), &star.GetUserStarsQuery{UserID: 12})
			require.NoError(t, err)
			require.Equal(t, 0, len(res.UserStars))
			res, err = starStore.List(context.Background(), &star.GetUserStarsQuery{UserID: 11})
			require.NoError(t, err)
			require.Equal(t, 1, len(res.UserStars))
		})
	})
}

//go:build integration
// +build integration

package starimpl

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/stretchr/testify/require"
)

func TestIntegrationUserStarsDataAccess(t *testing.T) {
	t.Run("Testing User Stars Data Access", func(t *testing.T) {
		ss := sqlstore.InitTestDB(t)
		starStore := sqlStore{db: ss}

		t.Run("Given saved star", func(t *testing.T) {
			cmd := star.StarDashboardCommand{
				DashboardID: 10,
				UserID:      12,
			}
			err := starStore.Insert(context.Background(), &cmd)
			require.NoError(t, err)

			t.Run("IsStarredByUser should return true when starred", func(t *testing.T) {
				query := star.IsStarredByUserQuery{UserID: 12, DashboardID: 10}
				isStarred, err := starStore.Get(context.Background(), &query)
				require.NoError(t, err)
				require.True(t, isStarred)
			})

			t.Run("IsStarredByUser should return false when not starred", func(t *testing.T) {
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
	})
}

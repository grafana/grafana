//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestUserStarsDataAccess(t *testing.T) {
	t.Run("Testing User Stars Data Access", func(t *testing.T) {
		sqlStore := InitTestDB(t)

		t.Run("Given saved star", func(t *testing.T) {
			cmd := models.StarDashboardCommand{
				DashboardId: 10,
				UserId:      12,
			}

			err := sqlStore.StarDashboard(context.Background(), &cmd)
			require.NoError(t, err)

			t.Run("IsStarredByUser should return true when starred", func(t *testing.T) {
				query := models.IsStarredByUserQuery{UserId: 12, DashboardId: 10}
				isStarred, err := stars.IsStarredByUserCtx(context.Background(), &query)
				require.NoError(t, err)

				require.True(t, isStarred)
			})

			t.Run("IsStarredByUser should return false when not starred", func(t *testing.T) {
				query := models.IsStarredByUserQuery{UserId: 12, DashboardId: 12}
				isStarred, err := sqlStore.IsStarredByUserCtx(context.Background(), &query)
				require.NoError(t, err)

				require.False(t, isStarred)
			})
		})
	})
}

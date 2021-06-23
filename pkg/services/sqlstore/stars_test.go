// +build integration

package sqlstore

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
)

func TestUserStarsDataAccess(t *testing.T) {
	t.Run("Testing User Stars Data Access", func(t *testing.T) {
		InitTestDB(t)

		t.Run("Given saved star", func(t *testing.T) {
			cmd := models.StarDashboardCommand{
				DashboardId: 10,
				UserId:      12,
			}

			err := StarDashboard(&cmd)
			require.NoError(t, err)

			t.Run("IsStarredByUser should return true when starred", func(t *testing.T) {
				query := models.IsStarredByUserQuery{UserId: 12, DashboardId: 10}
				err := IsStarredByUserCtx(context.Background(), &query)
				require.NoError(t, err)

				require.True(t, query.Result)
			})

			t.Run("IsStarredByUser should return false when not starred", func(t *testing.T) {
				query := models.IsStarredByUserQuery{UserId: 12, DashboardId: 12}
				err := IsStarredByUserCtx(context.Background(), &query)
				require.NoError(t, err)

				So(query.Result, ShouldBeFalse)
			})
		})
	})
}

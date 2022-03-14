//go:build integration
// +build integration

package star

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	starmodel "github.com/grafana/grafana/pkg/services/star/model"
	"github.com/stretchr/testify/require"
)

func TestUserStarsDataAccess(t *testing.T) {
	t.Run("Testing User Stars Data Access", func(t *testing.T) {
		sqlStore := sqlstore.InitTestDB(t)
		starsStore := newStarStore(sqlStore)

		t.Run("Given saved star", func(t *testing.T) {
			cmd := starmodel.StarDashboardCommand{
				DashboardId: 10,
				UserId:      12,
			}

			err := starsStore.insert(context.Background(), &cmd)
			require.NoError(t, err)

			t.Run("IsStarredByUser should return true when starred", func(t *testing.T) {
				query := starmodel.IsStarredByUserQuery{UserId: 12, DashboardId: 10}
				isStarred, err := starsStore.isStarredByUserCtx(context.Background(), &query)
				require.NoError(t, err)

				require.True(t, isStarred)
			})

			t.Run("IsStarredByUser should return false when not starred", func(t *testing.T) {
				query := starmodel.IsStarredByUserQuery{UserId: 12, DashboardId: 12}
				isStarred, err := starsStore.isStarredByUserCtx(context.Background(), &query)
				require.NoError(t, err)

				require.False(t, isStarred)
			})
		})
	})
}

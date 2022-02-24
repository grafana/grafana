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

func TestUserStarsDataAccess(t *testing.T) {
	t.Run("Testing User Stars Data Access", func(t *testing.T) {
		sqlStore := sqlstore.InitTestDB(t)
		starsStore := newStarStore(sqlStore)

		t.Run("Given saved star", func(t *testing.T) {
			cmd := star.StarDashboardCommand{
				DashboardID: 10,
				UserID:      12,
			}

			err := starsStore.create(context.Background(), &cmd)
			require.NoError(t, err)

			t.Run("IsStarredByUser should return true when starred", func(t *testing.T) {
				query := star.IsStarredByUserQuery{UserID: 12, DashboardID: 10}
				isStarred, err := starsStore.get(context.Background(), &query)
				require.NoError(t, err)

				require.True(t, isStarred)
			})

			t.Run("IsStarredByUser should return false when not starred", func(t *testing.T) {
				query := star.IsStarredByUserQuery{UserID: 12, DashboardID: 12}
				isStarred, err := starsStore.get(context.Background(), &query)
				require.NoError(t, err)

				require.False(t, isStarred)
			})
		})
	})
}

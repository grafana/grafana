package starimpl

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

type getStore func(db.DB) store

func testIntegrationUserStarsDataAccess(t *testing.T, fn getStore) {
	t.Helper()

	t.Run("Testing User Stars Data Access", func(t *testing.T) {
		ss := db.InitTestDB(t)
		starStore := fn(ss)

		t.Run("Given saved star by dashboard UID", func(t *testing.T) {
			cmd := star.StarDashboardCommand{
				DashboardUID: "test",
				OrgID:        1,
				UserID:       12,
			}
			err := starStore.Insert(context.Background(), &cmd)
			require.NoError(t, err)

			t.Run("Get should return true when starred", func(t *testing.T) {
				query := star.IsStarredByUserQuery{UserID: 12, DashboardUID: "test", OrgID: 1}
				isStarred, err := starStore.Get(context.Background(), &query)
				require.NoError(t, err)
				require.True(t, isStarred)
			})

			t.Run("Get should return false when not starred", func(t *testing.T) {
				query := star.IsStarredByUserQuery{UserID: 12, DashboardUID: "testing", OrgID: 1}
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
				deleteQuery := star.UnstarDashboardCommand{DashboardUID: "test", OrgID: 1, UserID: 12}
				err := starStore.Delete(context.Background(), &deleteQuery)
				require.NoError(t, err)
				getQuery := star.IsStarredByUserQuery{UserID: 12, DashboardUID: "test", OrgID: 1}
				isStarred, err := starStore.Get(context.Background(), &getQuery)
				require.NoError(t, err)
				require.False(t, isStarred)
			})
		})

		t.Run("DeleteByUser should remove the star for user", func(t *testing.T) {
			star1 := star.StarDashboardCommand{
				DashboardUID: "test",
				OrgID:        1,
				Updated:      time.Now(),
				UserID:       12,
			}
			err := starStore.Insert(context.Background(), &star1)
			require.NoError(t, err)
			star2 := star.StarDashboardCommand{
				DashboardUID: "test2",
				OrgID:        1,
				Updated:      time.Now(),
				UserID:       12,
			}
			err = starStore.Insert(context.Background(), &star2)
			require.NoError(t, err)
			star3 := star.StarDashboardCommand{
				DashboardUID: "test2",
				OrgID:        1,
				Updated:      time.Now(),
				UserID:       11,
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

func TestIntegration_StarMigrations(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	testDB := db.InitTestDB(t)

	d := dashboards.Dashboard{
		UID:     "test",
		Slug:    "org",
		Created: time.Now(),
		Updated: time.Now(),
		OrgID:   100,
	}
	_, err := testDB.GetEngine().Insert(&d)
	require.NoError(t, err)
	require.NotZero(t, d.ID)

	// Insert star record with NULL org_id and dashboard_uid
	_, err = testDB.GetEngine().Exec(`INSERT INTO star (id, user_id, dashboard_id, dashboard_uid, org_id, updated) VALUES (?,?,?,?,?,?)`,
		1000, 1, d.ID, nil, nil, time.Now())
	require.NoError(t, err)

	// Migration will update NULL user_id and dashboard_uid
	require.NoError(t, migrations.RunStarMigrations(testDB.GetEngine().NewSession(), testDB.GetDialect().DriverName()))

	// Check that star has updated fields
	var s []star.Star
	require.NoError(t, testDB.GetEngine().Find(&s))

	require.Len(t, s, 1)
	require.Equal(t, "test", s[0].DashboardUID)
	require.Equal(t, int64(100), s[0].OrgID)
}

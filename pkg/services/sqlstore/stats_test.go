package sqlstore

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestIntegrationStatsDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlStore := InitTestDB(t)
	populateDB(t, sqlStore)

	t.Run("Get system stats should not results in error", func(t *testing.T) {
		query := models.GetSystemStatsQuery{}
		err := sqlStore.GetSystemStats(context.Background(), &query)
		require.NoError(t, err)
		assert.Equal(t, int64(3), query.Result.Users)
		assert.Equal(t, int64(0), query.Result.Editors)
		assert.Equal(t, int64(0), query.Result.Viewers)
		assert.Equal(t, int64(3), query.Result.Admins)
		assert.Equal(t, int64(0), query.Result.LibraryPanels)
		assert.Equal(t, int64(0), query.Result.LibraryVariables)
		assert.Equal(t, int64(0), query.Result.APIKeys)
	})

	t.Run("Get system user count stats should not results in error", func(t *testing.T) {
		query := models.GetSystemUserCountStatsQuery{}
		err := sqlStore.GetSystemUserCountStats(context.Background(), &query)
		assert.NoError(t, err)
	})

	t.Run("Get datasource stats should not results in error", func(t *testing.T) {
		query := models.GetDataSourceStatsQuery{}
		err := sqlStore.GetDataSourceStats(context.Background(), &query)
		assert.NoError(t, err)
	})

	t.Run("Get datasource access stats should not results in error", func(t *testing.T) {
		query := models.GetDataSourceAccessStatsQuery{}
		err := sqlStore.GetDataSourceAccessStats(context.Background(), &query)
		assert.NoError(t, err)
	})

	t.Run("Get alert notifier stats should not results in error", func(t *testing.T) {
		query := models.GetAlertNotifierUsageStatsQuery{}
		err := sqlStore.GetAlertNotifiersUsageStats(context.Background(), &query)
		assert.NoError(t, err)
	})

	t.Run("Get admin stats should not result in error", func(t *testing.T) {
		query := models.GetAdminStatsQuery{}
		err := sqlStore.GetAdminStats(context.Background(), &query)
		assert.NoError(t, err)
	})
}

func populateDB(t *testing.T, sqlStore *SQLStore) {
	t.Helper()

	users := make([]user.User, 3)
	for i := range users {
		cmd := user.CreateUserCommand{
			Email:   fmt.Sprintf("usertest%v@test.com", i),
			Name:    fmt.Sprintf("user name %v", i),
			Login:   fmt.Sprintf("user_test_%v_login", i),
			OrgName: fmt.Sprintf("Org #%v", i),
		}
		user, err := sqlStore.CreateUser(context.Background(), cmd)
		require.NoError(t, err)
		users[i] = *user
	}

	// add 2nd user as editor
	cmd := &models.AddOrgUserCommand{
		OrgId:  users[0].OrgID,
		UserId: users[1].ID,
		Role:   org.RoleEditor,
	}
	err := sqlStore.addOrgUser(context.Background(), cmd)
	require.NoError(t, err)

	// add 3rd user as viewer
	cmd = &models.AddOrgUserCommand{
		OrgId:  users[0].OrgID,
		UserId: users[2].ID,
		Role:   org.RoleViewer,
	}
	err = sqlStore.addOrgUser(context.Background(), cmd)
	require.NoError(t, err)

	// add 1st user as admin
	cmd = &models.AddOrgUserCommand{
		OrgId:  users[1].OrgID,
		UserId: users[0].ID,
		Role:   org.RoleAdmin,
	}
	err = sqlStore.addOrgUser(context.Background(), cmd)
	require.NoError(t, err)

	// force renewal of user stats
	err = sqlStore.updateUserRoleCountsIfNecessary(context.Background(), true)
	require.NoError(t, err)
}

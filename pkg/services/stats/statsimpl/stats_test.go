package statsimpl

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/stats"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIntegrationStatsDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	db := sqlstore.InitTestDB(t)
	statsService := &sqlStatsService{db: db}
	populateDB(t, db)

	t.Run("Get system stats should not results in error", func(t *testing.T) {
		query := stats.GetSystemStatsQuery{}
		err := statsService.GetSystemStats(context.Background(), &query)
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
		query := stats.GetSystemUserCountStatsQuery{}
		err := statsService.GetSystemUserCountStats(context.Background(), &query)
		assert.NoError(t, err)
	})

	t.Run("Get datasource stats should not results in error", func(t *testing.T) {
		query := stats.GetDataSourceStatsQuery{}
		err := statsService.GetDataSourceStats(context.Background(), &query)
		assert.NoError(t, err)
	})

	t.Run("Get datasource access stats should not results in error", func(t *testing.T) {
		query := stats.GetDataSourceAccessStatsQuery{}
		err := statsService.GetDataSourceAccessStats(context.Background(), &query)
		assert.NoError(t, err)
	})

	t.Run("Get alert notifier stats should not results in error", func(t *testing.T) {
		query := stats.GetAlertNotifierUsageStatsQuery{}
		err := statsService.GetAlertNotifiersUsageStats(context.Background(), &query)
		assert.NoError(t, err)
	})

	t.Run("Get admin stats should not result in error", func(t *testing.T) {
		query := stats.GetAdminStatsQuery{}
		err := statsService.GetAdminStats(context.Background(), &query)
		assert.NoError(t, err)
	})
}

func populateDB(t *testing.T, sqlStore *sqlstore.SQLStore) {
	t.Helper()

	orgService, _ := orgimpl.ProvideService(sqlStore, sqlStore.Cfg, quotatest.New(false, nil))
	userSvc, _ := userimpl.ProvideService(sqlStore, orgService, sqlStore.Cfg, nil, nil, &quotatest.FakeQuotaService{})

	users := make([]user.User, 3)
	for i := range users {
		cmd := user.CreateUserCommand{
			Email:   fmt.Sprintf("usertest%v@test.com", i),
			Name:    fmt.Sprintf("user name %v", i),
			Login:   fmt.Sprintf("user_test_%v_login", i),
			OrgName: fmt.Sprintf("Org #%v", i),
		}
		user, err := userSvc.Create(context.Background(), &cmd)
		require.NoError(t, err)
		users[i] = *user
	}

	// add 2nd user as editor
	cmd := &org.AddOrgUserCommand{
		OrgID:  users[0].OrgID,
		UserID: users[1].ID,
		Role:   org.RoleEditor,
	}
	err := orgService.AddOrgUser(context.Background(), cmd)
	require.NoError(t, err)

	// add 3rd user as viewer
	cmd = &org.AddOrgUserCommand{
		OrgID:  users[0].OrgID,
		UserID: users[2].ID,
		Role:   org.RoleViewer,
	}
	err = orgService.AddOrgUser(context.Background(), cmd)
	require.NoError(t, err)

	// add 1st user as admin
	cmd = &org.AddOrgUserCommand{
		OrgID:  users[1].OrgID,
		UserID: users[0].ID,
		Role:   org.RoleAdmin,
	}
	err = orgService.AddOrgUser(context.Background(), cmd)
	require.NoError(t, err)
}

func TestIntegration_GetAdminStats(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	db := sqlstore.InitTestDB(t)
	statsService := ProvideService(&setting.Cfg{}, db)

	query := stats.GetAdminStatsQuery{}
	err := statsService.GetAdminStats(context.Background(), &query)
	require.NoError(t, err)
}

package statsimpl

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/correlations/correlationstest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/stats"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationStatsDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	db, cfg := db.InitTestDBWithCfg(t)
	orgSvc := populateDB(t, db, cfg)
	dashSvc := &dashboards.FakeDashboardService{}
	dashSvc.On("CountDashboardsInOrg", mock.Anything, int64(1)).Return(int64(2), nil)
	dashSvc.On("CountDashboardsInOrg", mock.Anything, int64(2)).Return(int64(1), nil)
	dashSvc.On("CountDashboardsInOrg", mock.Anything, int64(3)).Return(int64(0), nil)
	dashSvc.On("GetDashboardTags", mock.Anything, &dashboards.GetDashboardTagsQuery{OrgID: 1}).Return([]*dashboards.DashboardTagCloudItem{{Term: "test"}}, nil)
	dashSvc.On("GetDashboardTags", mock.Anything, &dashboards.GetDashboardTagsQuery{OrgID: 2}).Return([]*dashboards.DashboardTagCloudItem{}, nil)
	dashSvc.On("GetDashboardTags", mock.Anything, &dashboards.GetDashboardTagsQuery{OrgID: 3}).Return([]*dashboards.DashboardTagCloudItem{}, nil)

	folderService := &foldertest.FakeService{}
	folderService.ExpectedFolders = []*folder.Folder{{ID: 1}, {ID: 2}, {ID: 3}}

	statsService := &sqlStatsService{
		db:        db,
		dashSvc:   dashSvc,
		orgSvc:    orgSvc,
		folderSvc: folderService,
		features:  featuremgmt.WithFeatures(),
	}

	t.Run("Get system stats should not results in error", func(t *testing.T) {
		query := stats.GetSystemStatsQuery{}
		result, err := statsService.GetSystemStats(context.Background(), &query)
		require.NoError(t, err)
		assert.Equal(t, int64(3), result.Users)
		assert.Equal(t, int64(0), result.Editors)
		assert.Equal(t, int64(0), result.Viewers)
		assert.Equal(t, int64(3), result.Admins)
		assert.Equal(t, int64(0), result.LibraryPanels)
		assert.Equal(t, int64(0), result.LibraryVariables)
		assert.Equal(t, int64(0), result.APIKeys)
		assert.Equal(t, int64(2), result.Correlations)
		assert.Equal(t, int64(3), result.Orgs)
		assert.Equal(t, int64(3), result.Dashboards)
		assert.Equal(t, int64(9), result.Folders) // will return 3 folders for each org
		assert.NotNil(t, result.DatabaseCreatedTime)
		assert.Equal(t, db.GetDialect().DriverName(), result.DatabaseDriver)
	})

	t.Run("Get system user count stats should not results in error", func(t *testing.T) {
		query := stats.GetSystemUserCountStatsQuery{}
		_, err := statsService.GetSystemUserCountStats(context.Background(), &query)
		assert.NoError(t, err)
	})

	t.Run("Get datasource stats should not results in error", func(t *testing.T) {
		query := stats.GetDataSourceStatsQuery{}
		_, err := statsService.GetDataSourceStats(context.Background(), &query)
		assert.NoError(t, err)
	})

	t.Run("Get datasource access stats should not results in error", func(t *testing.T) {
		query := stats.GetDataSourceAccessStatsQuery{}
		_, err := statsService.GetDataSourceAccessStats(context.Background(), &query)
		assert.NoError(t, err)
	})

	t.Run("Get alert notifier stats should not results in error", func(t *testing.T) {
		query := stats.GetAlertNotifierUsageStatsQuery{}
		_, err := statsService.GetAlertNotifiersUsageStats(context.Background(), &query)
		assert.NoError(t, err)
	})

	t.Run("Get admin stats should not result in error", func(t *testing.T) {
		query := stats.GetAdminStatsQuery{}
		stats, err := statsService.GetAdminStats(context.Background(), &query)
		assert.NoError(t, err)
		assert.Equal(t, int64(1), stats.Tags)
		assert.Equal(t, int64(3), stats.Dashboards)
		assert.Equal(t, int64(3), stats.Orgs)
	})
}

func populateDB(t *testing.T, db db.DB, settingsProvider setting.SettingsProvider) org.Service {
	t.Helper()

	orgService, _ := orgimpl.ProvideService(db, settingsProvider, quotatest.New(false, nil))
	userSvc, _ := userimpl.ProvideService(
		db, orgService, settingsProvider, nil, nil, tracing.InitializeTracerForTest(),
		&quotatest.FakeQuotaService{}, supportbundlestest.NewFakeBundleService(),
	)

	bus := bus.ProvideBus(tracing.InitializeTracerForTest())
	correlationsSvc := correlationstest.New(db, settingsProvider, bus)

	c := make([]correlations.Correlation, 2)
	for i := range c {
		cmd := correlations.CreateCorrelationCommand{
			Label:     fmt.Sprintf("correlation %v", i),
			SourceUID: "graphite",
			OrgId:     1,
			Config: correlations.CorrelationConfig{
				Field:  "field",
				Target: map[string]any{},
				Type:   correlations.CorrelationType("query"),
			},
		}
		correlation, err := correlationsSvc.CreateCorrelation(context.Background(), cmd)
		require.NoError(t, err)
		c[i] = correlation
	}

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

	return orgService
}

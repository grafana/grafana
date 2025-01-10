package service

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/dualwrite"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/authz"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIntegrationDashboardServiceZanzana(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	t.Run("Zanzana enabled", func(t *testing.T) {
		features := featuremgmt.WithFeatures(featuremgmt.FlagZanzana)
		db, cfg := db.InitTestDBWithCfg(t)

		// Hack to skip these tests on mysql 5.7
		if db.GetDialect().DriverName() == migrator.MySQL {
			if supported, err := db.RecursiveQueriesAreSupported(); !supported || err != nil {
				t.Skip("skipping integration test")
			}
		}

		// Enable zanzana and run in embedded mode (part of grafana server)
		cfg.Zanzana.ZanzanaOnlyEvaluation = true
		cfg.Zanzana.Mode = setting.ZanzanaModeEmbedded
		cfg.Zanzana.ConcurrentChecks = 10

		_, err := cfg.Raw.Section("rbac").NewKey("resources_with_managed_permissions_on_creation", "dashboard, folder")
		require.NoError(t, err)

		quotaService := quotatest.New(false, nil)
		tagService := tagimpl.ProvideService(db)
		folderStore := folderimpl.ProvideDashboardFolderStore(db)
		fStore := folderimpl.ProvideStore(db)
		dashboardStore, err := database.ProvideDashboardStore(db, cfg, features, tagService)
		require.NoError(t, err)

		zclient, err := authz.ProvideZanzana(cfg, db, features)
		require.NoError(t, err)
		ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures(), zclient)

		service, err := ProvideDashboardServiceImpl(
			cfg, dashboardStore, folderStore,
			featuremgmt.WithFeatures(),
			accesscontrolmock.NewMockedPermissionsService(),
			accesscontrolmock.NewMockedPermissionsService(),
			ac,
			foldertest.NewFakeService(),
			fStore,
			nil,
			zclient,
			nil,
			nil,
			nil,
			quotaService,
			nil,
		)
		require.NoError(t, err)

		guardianMock := &guardian.FakeDashboardGuardian{
			CanSaveValue: true,
		}
		guardian.MockDashboardGuardian(guardianMock)

		createDashboards(t, service, 100, "test-a")
		createDashboards(t, service, 100, "test-b")

		folderImplStore := folderimpl.ProvideStore(db)
		folderService := folderimpl.ProvideService(
			folderImplStore,
			ac,
			bus.ProvideBus(tracing.InitializeTracerForTest()),
			dashboardStore,
			folderStore,
			db,
			featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders),
			supportbundlestest.NewFakeBundleService(),
			nil,
			tracing.InitializeTracerForTest(),
		)

		// Sync Grafana DB with zanzana (migrate data)
		tracer := tracing.InitializeTracerForTest()
		lock := serverlock.ProvideService(db, tracer)
		zanzanaSyncronizer := dualwrite.NewZanzanaReconciler(cfg, zclient, db, lock, folderService)
		err = zanzanaSyncronizer.ReconcileSync(context.Background())
		require.NoError(t, err)

		query := &dashboards.FindPersistedDashboardsQuery{
			Title: "test-a",
			Limit: 1000,
			SignedInUser: &user.SignedInUser{
				OrgID:     1,
				UserID:    1,
				UserUID:   "test1",
				Namespace: "default",
			},
		}
		res, err := service.FindDashboardsZanzana(context.Background(), query)

		require.NoError(t, err)
		assert.Equal(t, 0, len(res))
	})
}

func createDashboard(t *testing.T, service dashboards.DashboardService, uid, title string) {
	dto := &dashboards.SaveDashboardDTO{
		OrgID: 1,
		// User:  user,
		User: &user.SignedInUser{
			OrgID:  1,
			UserID: 1,
		},
	}
	dto.Dashboard = dashboards.NewDashboard(title)
	dto.Dashboard.SetUID(uid)

	_, err := service.SaveDashboard(context.Background(), dto, false)
	require.NoError(t, err)
}

func createDashboards(t *testing.T, service dashboards.DashboardService, number int, prefix string) {
	for i := 0; i < number; i++ {
		title := fmt.Sprintf("%s-%d", prefix, i)
		uid := fmt.Sprintf("dash-%s", title)
		createDashboard(t, service, uid, title)
	}
}

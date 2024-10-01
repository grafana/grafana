package service

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/migrator"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/authz"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIntegrationDashboardServiceZanzana(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	t.Run("Zanzana enabled", func(t *testing.T) {
		// t.Helper()

		features := featuremgmt.WithFeatures(featuremgmt.FlagZanzana)

		db := db.InitTestDB(t)

		cfg := setting.NewCfg()
		// Enable zanzana and run in embedded mode (part of grafana server)
		cfg.Zanzana.ZanzanaOnlyEvaluation = true
		cfg.Zanzana.Mode = setting.ZanzanaModeEmbedded
		setDBConfig(t, cfg, db)

		quotaService := quotatest.New(false, nil)
		tagService := tagimpl.ProvideService(db)
		folderStore := folderimpl.ProvideDashboardFolderStore(db)
		fStore := folderimpl.ProvideStore(db)
		dashboardStore, err := database.ProvideDashboardStore(db, cfg, features, tagService, quotaService)
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
		)
		require.NoError(t, err)

		_, err = dashboardStore.SaveDashboard(context.Background(), dashboards.SaveDashboardCommand{
			OrgID: 1,
			// FolderUID: folderUID,
			IsFolder: false,
			Dashboard: simplejson.NewFromAny(map[string]any{
				"id":    nil,
				"title": "Test",
			}),
		})
		require.NoError(t, err)

		// Sync Grafana DB with zanzana (migrate data)
		zanzanaSyncronizer := migrator.NewZanzanaSynchroniser(zclient, db)
		err = zanzanaSyncronizer.Sync(context.Background())
		require.NoError(t, err)

		query := &dashboards.FindPersistedDashboardsQuery{
			SignedInUser: &user.SignedInUser{
				OrgID:  1,
				UserID: 1,
			},
		}
		res, err := service.FindDashboardsZanzana(context.Background(), query)

		require.NoError(t, err)
		assert.Equal(t, 0, len(res))
	})
}

func setDBConfig(t *testing.T, cfg *setting.Cfg, db *sqlstore.SQLStore) {
	_, err := cfg.Raw.Section("database").NewKey("type", string(db.GetDBType()))
	require.NoError(t, err)
	_, err = cfg.Raw.Section("database").NewKey("name", "grafana_tests")
	require.NoError(t, err)
	_, err = cfg.Raw.Section("database").NewKey("user", "grafana")
	require.NoError(t, err)
	_, err = cfg.Raw.Section("database").NewKey("password", "password")
	require.NoError(t, err)
}

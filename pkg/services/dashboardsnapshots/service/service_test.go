package service

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	dashboardsnapshot "github.com/grafana/grafana/pkg/apis/dashboardsnapshot/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashdb "github.com/grafana/grafana/pkg/services/dashboards/database"
	dashsvc "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	dashsnapdb "github.com/grafana/grafana/pkg/services/dashboardsnapshots/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestDashboardSnapshotsService(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	dsStore := dashsnapdb.ProvideStore(sqlStore, cfg)
	fakeDashboardService := &dashboards.FakeDashboardService{}
	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))
	s := ProvideService(dsStore, secretsService, fakeDashboardService)

	origSecret := cfg.SecretKey
	cfg.SecretKey = "dashboard_snapshot_service_test"
	t.Cleanup(func() {
		cfg.SecretKey = origSecret
	})

	dashboardKey := "12345"

	dashboard := &common.Unstructured{}
	rawDashboard := []byte(`{"id":123}`)
	err := json.Unmarshal(rawDashboard, dashboard)
	require.NoError(t, err)

	t.Run("create dashboard snapshot should encrypt the dashboard", func(t *testing.T) {
		ctx := context.Background()

		cmd := dashboardsnapshots.CreateDashboardSnapshotCommand{
			Key:       dashboardKey,
			DeleteKey: dashboardKey,
			DashboardCreateCommand: dashboardsnapshot.DashboardCreateCommand{
				Dashboard: dashboard,
			},
		}

		result, err := s.CreateDashboardSnapshot(ctx, &cmd)
		require.NoError(t, err)

		decrypted, err := s.secretsService.Decrypt(ctx, result.DashboardEncrypted)
		require.NoError(t, err)

		require.Equal(t, rawDashboard, decrypted)
	})

	t.Run("get dashboard snapshot should return the dashboard decrypted", func(t *testing.T) {
		ctx := context.Background()

		query := dashboardsnapshots.GetDashboardSnapshotQuery{
			Key:       dashboardKey,
			DeleteKey: dashboardKey,
		}

		queryResult, err := s.GetDashboardSnapshot(ctx, &query)
		require.NoError(t, err)

		decrypted, err := queryResult.Dashboard.Encode()
		require.NoError(t, err)

		require.Equal(t, rawDashboard, decrypted)
	})
}

func TestValidateDashboardExists(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	dsStore := dashsnapdb.ProvideStore(sqlStore, cfg)
	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))
	feats := featuremgmt.WithFeatures()
	dashboardStore, err := dashdb.ProvideDashboardStore(sqlStore, cfg, feats, tagimpl.ProvideService(sqlStore))
	require.NoError(t, err)
	dashSvc, err := dashsvc.ProvideDashboardServiceImpl(
		cfg,
		dashboardStore,
		folderimpl.ProvideDashboardFolderStore(sqlStore),
		feats,
		nil,
		actest.FakeAccessControl{},
		actest.FakeService{},
		foldertest.NewFakeService(),
		nil,
		client.MockTestRestConfig{},
		nil,
		quotatest.New(false, nil),
		nil,
		nil,
		nil,
		dualwrite.ProvideTestService(),
		sort.ProvideService(),
		serverlock.ProvideService(sqlStore, tracing.InitializeTracerForTest()),
		kvstore.NewFakeKVStore(),
	)
	require.NoError(t, err)
	s := ProvideService(dsStore, secretsService, dashSvc)
	ctx := context.Background()

	t.Run("returns false when dashboard does not exist", func(t *testing.T) {
		err := s.ValidateDashboardExists(ctx, 1, "test")
		require.Error(t, err)
		require.Equal(t, dashboards.ErrDashboardNotFound, err)
	})

	t.Run("returns true when dashboard exists", func(t *testing.T) {
		err := createDashboard(sqlStore)
		require.NoError(t, err)

		err = s.ValidateDashboardExists(ctx, 1, "test")
		require.NoError(t, err)
	})
}

func createDashboard(store db.DB) error {
	return store.WithDbSession(context.Background(), func(sess *db.Session) error {
		dashboard := &dashboards.Dashboard{
			ID:      1,
			UID:     "test",
			OrgID:   1,
			Created: time.Now(),
			Updated: time.Now(),
		}

		_, err := sess.Insert(dashboard)
		return err
	})
}

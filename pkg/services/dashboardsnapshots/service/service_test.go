package service

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	snapshot "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	dashsnapdb "github.com/grafana/grafana/pkg/services/dashboardsnapshots/database"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationDashboardSnapshotsService(t *testing.T) {
	t.Parallel()
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := sqlstore.NewTestStore(t)
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
			DashboardCreateCommand: snapshot.DashboardCreateCommand{
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

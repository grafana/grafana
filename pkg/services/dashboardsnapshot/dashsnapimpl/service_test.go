package dashsnapimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	dashsnapshot "github.com/grafana/grafana/pkg/services/dashboardsnapshot"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func TestDashboardSnapshotsService(t *testing.T) {
	ss := sqlstore.InitTestDB(t)
	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(ss))
	s := ProvideService(ss, secretsService)

	origSecret := setting.SecretKey
	setting.SecretKey = "dashboard_snapshot_service_test"
	t.Cleanup(func() {
		setting.SecretKey = origSecret
	})

	dashboardKey := "12345"

	rawDashboard := []byte(`{"id":123}`)
	dashboard, err := simplejson.NewJson(rawDashboard)
	require.NoError(t, err)

	t.Run("create dashboard snapshot should encrypt the dashboard", func(t *testing.T) {
		ctx := context.Background()

		cmd := dashsnapshot.CreateDashboardSnapshotCommand{
			Key:       dashboardKey,
			DeleteKey: dashboardKey,
			Dashboard: dashboard,
		}

		err = s.CreateDashboardSnapshot(ctx, &cmd)
		require.NoError(t, err)

		decrypted, err := s.secretsService.Decrypt(ctx, cmd.Result.DashboardEncrypted)
		require.NoError(t, err)

		require.Equal(t, rawDashboard, decrypted)
	})

	t.Run("get dashboard snapshot should return the dashboard decrypted", func(t *testing.T) {
		ctx := context.Background()

		query := dashsnapshot.GetDashboardSnapshotQuery{
			Key:       dashboardKey,
			DeleteKey: dashboardKey,
		}

		err := s.GetDashboardSnapshot(ctx, &query)
		require.NoError(t, err)

		decrypted, err := query.Result.Dashboard.Encode()
		require.NoError(t, err)

		require.Equal(t, rawDashboard, decrypted)
	})
}

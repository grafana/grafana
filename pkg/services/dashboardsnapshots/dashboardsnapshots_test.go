package dashboardsnapshots

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

func TestDashboardSnapshotsService(t *testing.T) {
	sqlStore := sqlstore.InitTestDB(t)
	secretService := secrets.SetupTestService(t)

	s := &Service{
		SQLStore:       sqlStore,
		SecretsService: secretService,
	}

	dashboardKey := "12345"

	rawDashboard := []byte(`{"id":123}`)
	dashboard, err := simplejson.NewJson(rawDashboard)
	require.NoError(t, err)

	t.Run("create dashboard snapshot should encrypt the dashboard", func(t *testing.T) {
		cmd := models.CreateDashboardSnapshotCommand{
			Key:       dashboardKey,
			DeleteKey: dashboardKey,
			Dashboard: dashboard,
		}

		err = s.CreateDashboardSnapshot(&cmd)
		require.NoError(t, err)

		decrypted, err := s.SecretsService.Decrypt(cmd.Result.DashboardEncrypted)
		require.NoError(t, err)

		require.Equal(t, rawDashboard, decrypted)
	})

	t.Run("get dashboard snapshot should return the dashboard decrypted", func(t *testing.T) {
		query := models.GetDashboardSnapshotQuery{
			Key:       dashboardKey,
			DeleteKey: dashboardKey,
		}

		err := s.GetDashboardSnapshot(&query)
		require.NoError(t, err)

		decrypted, err := query.Result.Dashboard.Encode()
		require.NoError(t, err)

		require.Equal(t, rawDashboard, decrypted)
	})
}

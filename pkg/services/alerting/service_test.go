package alerting

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestService(t *testing.T) {
	sqlStore := sqlstore.InitTestDB(t)

	secretsService := secrets.SetupTestService(t)
	s := ProvideService(bus.New(), sqlStore, secretsService)

	origSecret := setting.SecretKey
	setting.SecretKey = "alert_notification_service_test"
	t.Cleanup(func() {
		setting.SecretKey = origSecret
	})

	var an *models.AlertNotification

	t.Run("create alert notification should encrypt the secure json data", func(t *testing.T) {
		ctx := context.Background()

		ss := map[string]string{"password": "12345"}
		cmd := models.CreateAlertNotificationCommand{SecureSettings: ss}

		err := s.CreateAlertNotificationCommand(ctx, &cmd)
		require.NoError(t, err)

		an = cmd.Result
		decrypted, err := s.SecretsService.DecryptJsonData(ctx, an.SecureSettings)
		require.NoError(t, err)
		require.Equal(t, ss, decrypted)
	})

	t.Run("update alert notification should encrypt the secure json data", func(t *testing.T) {
		ctx := context.Background()

		ss := map[string]string{"password": "678910"}
		cmd := models.UpdateAlertNotificationCommand{Id: an.Id, Settings: simplejson.New(), SecureSettings: ss}
		err := s.UpdateAlertNotification(ctx, &cmd)
		require.NoError(t, err)

		decrypted, err := s.SecretsService.DecryptJsonData(ctx, cmd.Result.SecureSettings)
		require.NoError(t, err)
		require.Equal(t, ss, decrypted)
	})
}

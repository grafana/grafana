package alerting

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/encryption/ossencryption"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestService(t *testing.T) {
	sqlStore := sqlstore.InitTestDB(t)

	nType := "test"
	registerTestNotifier(nType)

	s := ProvideService(sqlStore, ossencryption.ProvideService(), nil)

	origSecret := setting.SecretKey
	setting.SecretKey = "alert_notification_service_test"

	t.Cleanup(func() {
		setting.SecretKey = origSecret
	})

	t.Run("create alert notification should reject an invalid command", func(t *testing.T) {
		ctx := context.Background()

		ss := map[string]string{"password": "12345"}
		cmd := models.CreateAlertNotificationCommand{SecureSettings: ss}

		err := s.CreateAlertNotificationCommand(ctx, &cmd)
		require.Error(t, err)
	})

	t.Run("create alert notification should encrypt the secure json data", func(t *testing.T) {
		ctx := context.Background()

		ss := map[string]string{"password": "12345"}
		cmd := models.CreateAlertNotificationCommand{SecureSettings: ss, Type: nType}

		err := s.CreateAlertNotificationCommand(ctx, &cmd)
		require.NoError(t, err)

		an := cmd.Result
		decrypted, err := s.EncryptionService.DecryptJsonData(ctx, an.SecureSettings, setting.SecretKey)
		require.NoError(t, err)
		require.Equal(t, ss, decrypted)

		// Delete the created alert notification
		delCmd := models.DeleteAlertNotificationCommand{
			Id:    cmd.Result.Id,
			OrgId: cmd.Result.OrgId,
		}
		err = s.DeleteAlertNotification(context.Background(), &delCmd)
		require.NoError(t, err)
	})

	t.Run("update alert notification should reject an invalid command", func(t *testing.T) {
		ctx := context.Background()

		// Save test notification.
		ss := map[string]string{"password": "12345"}
		createCmd := models.CreateAlertNotificationCommand{SecureSettings: ss, Type: nType}

		err := s.CreateAlertNotificationCommand(ctx, &createCmd)
		require.NoError(t, err)

		// Try to update it with an invalid type.
		updateCmd := models.UpdateAlertNotificationCommand{Id: createCmd.Result.Id, Settings: simplejson.New(), SecureSettings: ss, Type: "invalid"}
		err = s.UpdateAlertNotification(ctx, &updateCmd)
		require.Error(t, err)

		// Delete the created alert notification.
		delCmd := models.DeleteAlertNotificationCommand{
			Id:    createCmd.Result.Id,
			OrgId: createCmd.Result.OrgId,
		}
		err = s.DeleteAlertNotification(context.Background(), &delCmd)
		require.NoError(t, err)
	})

	t.Run("update alert notification should encrypt the secure json data", func(t *testing.T) {
		ctx := context.Background()

		// Save test notification.
		ss := map[string]string{"password": "12345"}
		createCmd := models.CreateAlertNotificationCommand{SecureSettings: ss, Type: nType}

		err := s.CreateAlertNotificationCommand(ctx, &createCmd)
		require.NoError(t, err)

		// Update test notification.
		updateCmd := models.UpdateAlertNotificationCommand{Id: createCmd.Result.Id, Settings: simplejson.New(), SecureSettings: ss, Type: nType}
		err = s.UpdateAlertNotification(ctx, &updateCmd)
		require.NoError(t, err)

		decrypted, err := s.EncryptionService.DecryptJsonData(ctx, updateCmd.Result.SecureSettings, setting.SecretKey)
		require.NoError(t, err)
		require.Equal(t, ss, decrypted)

		// Delete the created alert notification.
		delCmd := models.DeleteAlertNotificationCommand{
			Id:    createCmd.Result.Id,
			OrgId: createCmd.Result.OrgId,
		}
		err = s.DeleteAlertNotification(context.Background(), &delCmd)
		require.NoError(t, err)
	})
}

func registerTestNotifier(notifierType string) {
	RegisterNotifier(&NotifierPlugin{
		Type: notifierType,
		Factory: func(*models.AlertNotification, GetDecryptedValueFn, notifications.Service) (Notifier, error) {
			return nil, nil
		},
	})
}

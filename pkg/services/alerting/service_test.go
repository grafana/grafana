package alerting

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	encryptionprovider "github.com/grafana/grafana/pkg/services/encryption/provider"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
)

func TestService(t *testing.T) {
	sqlStore := &sqlStore{
		db:    db.InitTestDB(t),
		log:   &log.ConcreteLogger{},
		cache: localcache.New(time.Minute, time.Minute),
	}

	nType := "test"
	registerTestNotifier(nType)

	usMock := &usagestats.UsageStatsMock{T: t}

	encProvider := encryptionprovider.ProvideEncryptionProvider()
	encService, err := encryptionservice.ProvideEncryptionService(encProvider, usMock, setting.NewCfg())
	require.NoError(t, err)

	s := ProvideService(sqlStore.db, encService, nil)

	origSecret := setting.SecretKey
	setting.SecretKey = "alert_notification_service_test"

	t.Cleanup(func() {
		setting.SecretKey = origSecret
	})

	t.Run("create alert notification should reject an invalid command", func(t *testing.T) {
		ctx := context.Background()

		ss := map[string]string{"password": "12345"}
		cmd := models.CreateAlertNotificationCommand{SecureSettings: ss}

		_, err := s.CreateAlertNotificationCommand(ctx, &cmd)
		require.Error(t, err)
	})

	t.Run("create alert notification should encrypt the secure json data", func(t *testing.T) {
		ctx := context.Background()

		ss := map[string]string{"password": "12345"}
		cmd := models.CreateAlertNotificationCommand{SecureSettings: ss, Type: nType}

		an, err := s.CreateAlertNotificationCommand(ctx, &cmd)
		require.NoError(t, err)

		decrypted, err := s.EncryptionService.DecryptJsonData(ctx, an.SecureSettings, setting.SecretKey)
		require.NoError(t, err)
		require.Equal(t, ss, decrypted)

		// Delete the created alert notification
		delCmd := models.DeleteAlertNotificationCommand{
			ID:    an.ID,
			OrgID: an.OrgID,
		}
		err = s.DeleteAlertNotification(context.Background(), &delCmd)
		require.NoError(t, err)
	})

	t.Run("update alert notification should reject an invalid command", func(t *testing.T) {
		ctx := context.Background()

		// Save test notification.
		ss := map[string]string{"password": "12345"}
		createCmd := models.CreateAlertNotificationCommand{SecureSettings: ss, Type: nType}

		n, err := s.CreateAlertNotificationCommand(ctx, &createCmd)
		require.NoError(t, err)

		// Try to update it with an invalid type.
		updateCmd := models.UpdateAlertNotificationCommand{ID: n.ID, Settings: simplejson.New(), SecureSettings: ss, Type: "invalid"}
		_, err = s.UpdateAlertNotification(ctx, &updateCmd)
		require.Error(t, err)

		// Delete the created alert notification.
		delCmd := models.DeleteAlertNotificationCommand{
			ID:    n.ID,
			OrgID: n.OrgID,
		}
		err = s.DeleteAlertNotification(context.Background(), &delCmd)
		require.NoError(t, err)
	})

	t.Run("update alert notification should encrypt the secure json data", func(t *testing.T) {
		ctx := context.Background()

		// Save test notification.
		ss := map[string]string{"password": "12345"}
		createCmd := models.CreateAlertNotificationCommand{SecureSettings: ss, Type: nType}

		n, err := s.CreateAlertNotificationCommand(ctx, &createCmd)
		require.NoError(t, err)

		// Update test notification.
		updateCmd := models.UpdateAlertNotificationCommand{ID: n.ID, Settings: simplejson.New(), SecureSettings: ss, Type: nType}
		n2, err := s.UpdateAlertNotification(ctx, &updateCmd)
		require.NoError(t, err)

		decrypted, err := s.EncryptionService.DecryptJsonData(ctx, n2.SecureSettings, setting.SecretKey)
		require.NoError(t, err)
		require.Equal(t, ss, decrypted)

		// Delete the created alert notification.
		delCmd := models.DeleteAlertNotificationCommand{
			ID:    n.ID,
			OrgID: n.OrgID,
		}
		err = s.DeleteAlertNotification(context.Background(), &delCmd)
		require.NoError(t, err)
	})

	t.Run("create alert notification should reject an invalid command", func(t *testing.T) {
		uid := strings.Repeat("A", 41)

		_, err := s.CreateAlertNotificationCommand(context.Background(), &models.CreateAlertNotificationCommand{UID: uid})
		require.ErrorIs(t, err, ValidationError{Reason: "Invalid UID: Must be 40 characters or less"})
	})

	t.Run("update alert notification should reject an invalid command", func(t *testing.T) {
		ctx := context.Background()

		uid := strings.Repeat("A", 41)
		expectedErr := ValidationError{Reason: "Invalid UID: Must be 40 characters or less"}

		_, err := s.UpdateAlertNotification(ctx, &models.UpdateAlertNotificationCommand{UID: uid})
		require.ErrorIs(t, err, expectedErr)

		_, err = s.UpdateAlertNotificationWithUid(ctx, &models.UpdateAlertNotificationWithUidCommand{NewUID: uid})
		require.ErrorIs(t, err, expectedErr)
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

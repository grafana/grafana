package appconfig

import (
	"testing"

	authtypes "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestHistorian(t *testing.T) {
	enabled := func(loki setting.UnifiedAlertingLokiSettings) *setting.Cfg {
		cfg := setting.NewCfg()
		cfg.UnifiedAlerting.NotificationHistory = setting.UnifiedAlertingNotificationHistorySettings{
			Enabled:      true,
			LokiSettings: loki,
		}
		return cfg
	}

	t.Run("a nil cfg returns an empty config", func(t *testing.T) {
		got, err := Historian(nil, Deps{AccessClient: authtypes.FixedAccessClient(true)})
		require.NoError(t, err)
		require.False(t, got.Notification.Enabled)
		require.Nil(t, got.Notification.AccessClient)
	})

	t.Run("disabled notification history ignores the Loki settings", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.UnifiedAlerting.NotificationHistory.LokiSettings.LokiRemoteURL = "://://"

		got, err := Historian(cfg, Deps{})
		require.NoError(t, err)
		require.False(t, got.Notification.Enabled)
	})

	t.Run("enabled notification history reads the Loki settings and restricts by RBAC", func(t *testing.T) {
		access := authtypes.FixedAccessClient(true)
		cfg := enabled(setting.UnifiedAlertingLokiSettings{
			LokiRemoteURL: "http://loki:3100",
			LokiTenantID:  "tenant",
		})

		got, err := Historian(cfg, Deps{AccessClient: access})
		require.NoError(t, err)
		require.True(t, got.Notification.Enabled)
		require.Equal(t, "http://loki:3100", got.Notification.Loki.ReadPathURL.String())
		require.Equal(t, "http://loki:3100", got.Notification.Loki.WritePathURL.String())
		require.Equal(t, "tenant", got.Notification.Loki.TenantID)
		require.True(t, got.Notification.RBACEnabled)
		require.Equal(t, access, got.Notification.AccessClient)
	})

	t.Run("enabled notification history without a Loki URL is an error", func(t *testing.T) {
		_, err := Historian(enabled(setting.UnifiedAlertingLokiSettings{}), Deps{AccessClient: authtypes.FixedAccessClient(true)})
		require.ErrorContains(t, err, "remote Loki URL")
	})

	t.Run("enabled notification history without an access client is an error", func(t *testing.T) {
		_, err := Historian(enabled(setting.UnifiedAlertingLokiSettings{LokiRemoteURL: "http://loki:3100"}), Deps{})
		require.ErrorContains(t, err, "no access client")
	})

	t.Run("does not ask the app to send the stack ID to Loki unless configured", func(t *testing.T) {
		cfg := enabled(setting.UnifiedAlertingLokiSettings{LokiRemoteURL: "http://loki:3100"})
		got, err := Historian(cfg, Deps{AccessClient: authtypes.FixedAccessClient(true)})
		require.NoError(t, err)
		require.False(t, got.Notification.Loki.InjectUser)
	})

	t.Run("asks the app to send the stack ID to Loki when configured", func(t *testing.T) {
		cfg := enabled(setting.UnifiedAlertingLokiSettings{LokiRemoteURL: "http://loki:3100"})
		cfg.UnifiedAlerting.NotificationHistory.LokiInjectUser = true
		got, err := Historian(cfg, Deps{AccessClient: authtypes.FixedAccessClient(true)})
		require.NoError(t, err)
		require.True(t, got.Notification.Loki.InjectUser)
	})

	t.Run("does not set the state history handler", func(t *testing.T) {
		got, err := Historian(enabled(setting.UnifiedAlertingLokiSettings{LokiRemoteURL: "http://loki:3100"}), Deps{AccessClient: authtypes.FixedAccessClient(true)})
		require.NoError(t, err)
		require.Nil(t, got.GetAlertStateHistoryHandler)
	})
}

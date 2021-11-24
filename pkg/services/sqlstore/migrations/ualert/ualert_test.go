package ualert

import (
	"fmt"
	"math/rand"
	"testing"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"

	"github.com/stretchr/testify/require"
)

func Test_validateAlertmanagerConfig(t *testing.T) {
	tc := []struct {
		name      string
		receivers []*PostableGrafanaReceiver
		err       error
	}{
		{
			name: "when a slack receiver does not have a valid URL - it should error",
			receivers: []*PostableGrafanaReceiver{
				{
					UID:            util.GenerateShortUID(),
					Name:           "SlackWithBadURL",
					Type:           "slack",
					Settings:       simplejson.NewFromAny(map[string]interface{}{}),
					SecureSettings: map[string]string{"url": invalidUri},
				},
			},
			err: fmt.Errorf("failed to validate receiver \"SlackWithBadURL\" of type \"slack\": invalid URL %q: parse %q: net/url: invalid control character in URL", invalidUri, invalidUri),
		},
		{
			name: "when a slack receiver has an invalid recipient - it should not error",
			receivers: []*PostableGrafanaReceiver{
				{
					UID:            util.GenerateShortUID(),
					Name:           "SlackWithBadRecipient",
					Type:           "slack",
					Settings:       simplejson.NewFromAny(map[string]interface{}{"recipient": "this passes"}),
					SecureSettings: map[string]string{"url": "http://webhook.slack.com/myuser"},
				},
			},
		},
		{
			name: "when the configuration is valid - it should not error",
			receivers: []*PostableGrafanaReceiver{
				{
					UID:            util.GenerateShortUID(),
					Name:           "SlackWithBadURL",
					Type:           "slack",
					Settings:       simplejson.NewFromAny(map[string]interface{}{"recipient": "#a-good-channel"}),
					SecureSettings: map[string]string{"url": "http://webhook.slack.com/myuser"},
				},
			},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			mg := newTestMigration(t)
			orgID := int64(1)

			config := configFromReceivers(t, tt.receivers)
			require.NoError(t, config.EncryptSecureSettings()) // make sure we encrypt the settings
			err := mg.validateAlertmanagerConfig(orgID, config)
			if tt.err != nil {
				require.Error(t, err)
				require.EqualError(t, err, tt.err.Error())
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestCheckUnifiedAlertingEnabledByDefault(t *testing.T) {
	testDB := sqlutil.SQLite3TestDB()
	x, err := xorm.NewEngine(testDB.DriverName, testDB.ConnStr)
	require.NoError(t, err)
	_, err = x.Exec("CREATE TABLE alert ( id bigint )")
	require.NoError(t, err)
	t.Cleanup(func() {
		_, err = x.Exec("DROP TABLE alert")
		require.NoError(t, err)
	})

	t.Run("when 'alert' table has no data", func(t *testing.T) {
		t.Run("it should fail if legacy alerting is explicitly enabled", func(t *testing.T) {
			legacyEnabled := true
			setting.AlertingEnabled = &legacyEnabled

			cfg := setting.Cfg{
				UnifiedAlerting: setting.UnifiedAlertingSettings{
					Enabled: nil,
				},
			}
			mg := migrator.NewMigrator(x, &cfg)

			err := CheckUnifiedAlertingEnabledByDefault(mg)
			require.Error(t, err)
			require.Nil(t, cfg.UnifiedAlerting.Enabled)
		})
		t.Run("should enable unified alerting and disable legacy", func(t *testing.T) {
			setting.AlertingEnabled = nil
			cfg := setting.Cfg{
				UnifiedAlerting: setting.UnifiedAlertingSettings{
					Enabled: nil,
				},
			}
			mg := migrator.NewMigrator(x, &cfg)

			err := CheckUnifiedAlertingEnabledByDefault(mg)
			require.NoError(t, err)

			require.NotNil(t, setting.AlertingEnabled)
			require.False(t, *setting.AlertingEnabled)
			require.NotNil(t, cfg.UnifiedAlerting.Enabled)
			require.True(t, *cfg.UnifiedAlerting.Enabled)
		})
	})
	t.Run("when alert table has data", func(t *testing.T) {
		_, err := x.Exec("INSERT INTO alert VALUES (1)")
		require.NoError(t, err)
		t.Cleanup(func() {
			_, err := x.Exec("DELETE FROM alert")
			require.NoError(t, err)
		})

		t.Run("it should disable unified alerting and enable legacy", func(t *testing.T) {
			setting.AlertingEnabled = nil
			cfg := setting.Cfg{
				UnifiedAlerting: setting.UnifiedAlertingSettings{
					Enabled: nil,
				},
			}
			mg := migrator.NewMigrator(x, &cfg)

			err := CheckUnifiedAlertingEnabledByDefault(mg)
			require.NoError(t, err)

			require.NotNil(t, setting.AlertingEnabled)
			require.True(t, *setting.AlertingEnabled)
			require.NotNil(t, cfg.UnifiedAlerting.Enabled)
			require.False(t, *cfg.UnifiedAlerting.Enabled)
		})

		t.Run("should not change legacy alerting if it is defined", func(t *testing.T) {
			legacyEnabled := rand.Int63()%2 == 0
			setting.AlertingEnabled = &legacyEnabled
			cfg := setting.Cfg{
				UnifiedAlerting: setting.UnifiedAlertingSettings{
					Enabled: nil,
				},
			}
			mg := migrator.NewMigrator(x, &cfg)

			err := CheckUnifiedAlertingEnabledByDefault(mg)
			require.NoError(t, err)

			require.NotNil(t, setting.AlertingEnabled)
			require.Equal(t, legacyEnabled, *setting.AlertingEnabled)
			require.NotNil(t, cfg.UnifiedAlerting.Enabled)
			require.False(t, *cfg.UnifiedAlerting.Enabled)
		})
	})
}

func configFromReceivers(t *testing.T, receivers []*PostableGrafanaReceiver) *PostableUserConfig {
	t.Helper()

	return &PostableUserConfig{
		AlertmanagerConfig: PostableApiAlertingConfig{
			Receivers: []*PostableApiReceiver{
				{GrafanaManagedReceivers: receivers},
			},
		},
	}
}

const invalidUri = "�6�M��)uk譹1(�h`$�o�N>mĕ����cS2�dh![ę�	���`csB�!��OSxP�{�"

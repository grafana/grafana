package ualert

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"sort"
	"testing"

	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/require"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var MigTitle = migTitle
var RmMigTitle = rmMigTitle
var ClearMigrationEntryTitle = clearMigrationEntryTitle

type RmMigration = rmMigration

func (m *Matchers) UnmarshalJSON(data []byte) error {
	var lines []string
	if err := json.Unmarshal(data, &lines); err != nil {
		return err
	}
	for _, line := range lines {
		pm, err := labels.ParseMatchers(line)
		if err != nil {
			return err
		}
		*m = append(*m, pm...)
	}
	sort.Sort(labels.Matchers(*m))
	return nil
}

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
			err: fmt.Errorf("failed to validate receiver \"SlackWithBadURL\" of type \"slack\": invalid URL %q", invalidUri),
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

	tests := []struct {
		title                   string
		legacyAlertExists       bool
		legacyIsDefined         bool
		legacyValue             bool
		expectedUnifiedAlerting bool
	}{
		{
			title:                   "enable unified alerting when there are no legacy alerts",
			legacyIsDefined:         false,
			legacyAlertExists:       false,
			expectedUnifiedAlerting: true,
		},
		{
			title:                   "enable unified alerting when there are no legacy alerts and legacy enabled",
			legacyIsDefined:         true,
			legacyValue:             true,
			legacyAlertExists:       false,
			expectedUnifiedAlerting: true,
		},
		{
			title:                   "enable unified alerting when there are no legacy alerts and legacy disabled",
			legacyIsDefined:         true,
			legacyValue:             false,
			legacyAlertExists:       false,
			expectedUnifiedAlerting: true,
		},
		{
			title:                   "enable unified alerting when there are legacy alerts but legacy disabled",
			legacyIsDefined:         true,
			legacyValue:             false,
			legacyAlertExists:       true,
			expectedUnifiedAlerting: true,
		},
		{
			title:                   "disable unified alerting when there are legacy alerts",
			legacyIsDefined:         false,
			legacyAlertExists:       true,
			expectedUnifiedAlerting: false,
		},
		{
			title:                   "disable unified alerting when there are legacy alerts and it is enabled",
			legacyIsDefined:         true,
			legacyValue:             true,
			legacyAlertExists:       true,
			expectedUnifiedAlerting: false,
		},
	}

	for _, test := range tests {
		t.Run(test.title, func(t *testing.T) {
			setting.AlertingEnabled = nil
			if test.legacyIsDefined {
				value := test.legacyValue
				setting.AlertingEnabled = &value
			}

			if test.legacyAlertExists {
				_, err := x.Exec("INSERT INTO alert VALUES (1)")
				require.NoError(t, err)
			} else {
				_, err := x.Exec("DELETE FROM alert")
				require.NoError(t, err)
			}

			cfg := setting.Cfg{
				UnifiedAlerting: setting.UnifiedAlertingSettings{
					Enabled: nil,
				},
			}
			mg := migrator.NewMigrator(x, &cfg)

			err := CheckUnifiedAlertingEnabledByDefault(mg)
			require.NoError(t, err)
			require.NotNil(t, setting.AlertingEnabled)
			require.NotNil(t, cfg.UnifiedAlerting.Enabled)
			require.Equal(t, *cfg.UnifiedAlerting.Enabled, test.expectedUnifiedAlerting)
			require.Equal(t, *setting.AlertingEnabled, !test.expectedUnifiedAlerting)
		})
	}
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

func (c *PostableUserConfig) EncryptSecureSettings() error {
	for _, r := range c.AlertmanagerConfig.Receivers {
		for _, gr := range r.GrafanaManagedReceivers {
			encryptedData := GetEncryptedJsonData(gr.SecureSettings)
			for k, v := range encryptedData {
				gr.SecureSettings[k] = base64.StdEncoding.EncodeToString(v)
			}
		}
	}
	return nil
}

const invalidUri = "�6�M��)uk譹1(�h`$�o�N>mĕ����cS2�dh![ę�	���`csB�!��OSxP�{�"

func Test_getAlertFolderNameFromDashboard(t *testing.T) {
	t.Run("should include full title", func(t *testing.T) {
		dash := &dashboard{
			Uid:   util.GenerateShortUID(),
			Title: "TEST",
		}
		folder := getAlertFolderNameFromDashboard(dash)
		require.Contains(t, folder, dash.Title)
		require.Contains(t, folder, dash.Uid)
	})
	t.Run("should cut title to the length", func(t *testing.T) {
		title := ""
		for {
			title += util.GenerateShortUID()
			if len(title) > MaxFolderName {
				title = title[:MaxFolderName]
				break
			}
		}

		dash := &dashboard{
			Uid:   util.GenerateShortUID(),
			Title: title,
		}
		folder := getAlertFolderNameFromDashboard(dash)
		require.Len(t, folder, MaxFolderName)
		require.Contains(t, folder, dash.Uid)
	})
}

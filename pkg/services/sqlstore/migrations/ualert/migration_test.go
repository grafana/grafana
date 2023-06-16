package ualert_test

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/ualert"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
)

// TestAddDashAlertMigration tests the AddDashAlertMigration wrapper method that decides when to run the migration based on migration status and settings.
func TestAddDashAlertMigration(t *testing.T) {
	x := setupTestDB(t)

	tc := []struct {
		name           string
		config         *setting.Cfg
		isMigrationRun bool
		shouldPanic    bool
		expected       []string // set of migration titles
	}{
		{
			name: "when unified alerting enabled and migration not already run, then add main migration and clear rmMigration log entry",
			config: &setting.Cfg{
				UnifiedAlerting: setting.UnifiedAlertingSettings{
					Enabled: boolPointer(true),
				},
			},
			isMigrationRun: false,
			expected:       []string{fmt.Sprintf(ualert.ClearMigrationEntryTitle, ualert.RmMigTitle), ualert.MigTitle},
		},
		{
			name: "when unified alerting disabled and migration is already run, then add rmMigration and clear main migration log entry",
			config: &setting.Cfg{
				UnifiedAlerting: setting.UnifiedAlertingSettings{
					Enabled: boolPointer(false),
				},
				ForceMigration: true,
			},
			isMigrationRun: true,
			expected:       []string{fmt.Sprintf(ualert.ClearMigrationEntryTitle, ualert.MigTitle), ualert.RmMigTitle},
		},
		{
			name: "when unified alerting disabled, migration is already run and force migration is disabled, then the migration should panic",
			config: &setting.Cfg{
				UnifiedAlerting: setting.UnifiedAlertingSettings{
					Enabled: boolPointer(false),
				},
				ForceMigration: false,
			},
			isMigrationRun: true,
			expected:       []string{fmt.Sprintf(ualert.ClearMigrationEntryTitle, ualert.MigTitle), ualert.RmMigTitle},
		},
		{
			name: "when unified alerting enabled and migration is already run, then do nothing",
			config: &setting.Cfg{
				UnifiedAlerting: setting.UnifiedAlertingSettings{
					Enabled: boolPointer(true),
				},
			},
			isMigrationRun: true,
			expected:       []string{},
		},
		{
			name: "when unified alerting disabled and migration is not already run, then do nothing",
			config: &setting.Cfg{
				UnifiedAlerting: setting.UnifiedAlertingSettings{
					Enabled: boolPointer(false),
				},
			},
			isMigrationRun: false,
			expected:       []string{},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			defer func() {
				// if the code should panic, make sure it has
				if r := recover(); r == nil && tt.shouldPanic {
					t.Errorf("The code did not panic")
				}
			}()
			if tt.isMigrationRun {
				log := migrator.MigrationLog{
					MigrationID: ualert.MigTitle,
					SQL:         "",
					Timestamp:   time.Now(),
					Success:     true,
				}
				_, err := x.Insert(log)
				require.NoError(t, err)
			} else {
				_, err := x.Exec("DELETE FROM migration_log WHERE migration_id = ?", ualert.MigTitle)
				require.NoError(t, err)
			}

			mg := migrator.NewMigrator(x, tt.config)

			ualert.AddDashAlertMigration(mg)
			require.Equal(t, tt.expected, mg.GetMigrationIDs(false))
		})
	}
}

// TestAMConfigMigration tests the execution of the main DashAlertMigration specifically for migrations of channels and routes.
func TestAMConfigMigration(t *testing.T) {
	// Run initial migration to have a working DB.
	x := setupTestDB(t)

	tc := []struct {
		name           string
		legacyChannels []*models.AlertNotification
		alerts         []*models.Alert

		expected map[int64]*ualert.PostableUserConfig
		expErr   error
	}{
		{
			name: "general multi-org, multi-alert, multi-channel migration",
			legacyChannels: []*models.AlertNotification{
				createAlertNotification(t, int64(1), "notifier1", "email", emailSettings, false),
				createAlertNotification(t, int64(1), "notifier2", "slack", slackSettings, false),
				createAlertNotification(t, int64(1), "notifier3", "opsgenie", opsgenieSettings, false),
				createAlertNotification(t, int64(2), "notifier4", "email", emailSettings, false),
				createAlertNotification(t, int64(2), "notifier5", "slack", slackSettings, false),
				createAlertNotification(t, int64(2), "notifier6", "opsgenie", opsgenieSettings, true), // default
			},
			alerts: []*models.Alert{
				createAlert(t, int64(1), int64(1), int64(1), "alert1", []string{"notifier1"}),
				createAlert(t, int64(1), int64(1), int64(2), "alert2", []string{"notifier2", "notifier3"}),
				createAlert(t, int64(1), int64(2), int64(3), "alert3", []string{"notifier3"}),
				createAlert(t, int64(2), int64(3), int64(1), "alert4", []string{"notifier4"}),
				createAlert(t, int64(2), int64(3), int64(2), "alert5", []string{"notifier4", "notifier5", "notifier6"}),
				createAlert(t, int64(2), int64(4), int64(3), "alert6", []string{}),
			},
			expected: map[int64]*ualert.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: ualert.PostableApiAlertingConfig{
						Route: &ualert.Route{
							Receiver:   "autogen-contact-point-default",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*ualert.Route{
								{Receiver: "notifier1", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(ualert.DisabledRepeatInterval)},
								{Receiver: "notifier2", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier2".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(ualert.DisabledRepeatInterval)},
								{Receiver: "notifier3", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier3".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(ualert.DisabledRepeatInterval)},
							},
							RepeatInterval: nil,
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "notifier1", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}},
							{Name: "notifier2", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier2", Type: "slack"}}},
							{Name: "notifier3", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier3", Type: "opsgenie"}}},
							{Name: "autogen-contact-point-default"}, // empty default
						},
					},
				},
				int64(2): {
					AlertmanagerConfig: ualert.PostableApiAlertingConfig{
						Route: &ualert.Route{
							Receiver:   "notifier6",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*ualert.Route{
								{Receiver: "notifier4", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier4".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(ualert.DisabledRepeatInterval)},
								{Receiver: "notifier5", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier5".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(ualert.DisabledRepeatInterval)},
								{Receiver: "notifier6", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier6".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(ualert.DisabledRepeatInterval)},
							},
							RepeatInterval: durationPointer(ualert.DisabledRepeatInterval),
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "notifier4", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier4", Type: "email"}}},
							{Name: "notifier5", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier5", Type: "slack"}}},
							{Name: "notifier6", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier6", Type: "opsgenie"}}},
						},
					},
				},
			},
		},
		{
			name: "when no default channel, create empty autogen-contact-point-default",
			legacyChannels: []*models.AlertNotification{
				createAlertNotification(t, int64(1), "notifier1", "email", emailSettings, false),
			},
			alerts: []*models.Alert{},
			expected: map[int64]*ualert.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: ualert.PostableApiAlertingConfig{
						Route: &ualert.Route{
							Receiver:   "autogen-contact-point-default",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*ualert.Route{
								{Receiver: "notifier1", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(ualert.DisabledRepeatInterval)},
							},
							RepeatInterval: nil,
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "notifier1", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}},
							{Name: "autogen-contact-point-default"},
						},
					},
				},
			},
		},
		{
			name: "when single default channel, don't create autogen-contact-point-default",
			legacyChannels: []*models.AlertNotification{
				createAlertNotification(t, int64(1), "notifier1", "email", emailSettings, true),
			},
			alerts: []*models.Alert{},
			expected: map[int64]*ualert.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: ualert.PostableApiAlertingConfig{
						Route: &ualert.Route{
							Receiver:   "notifier1",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*ualert.Route{
								{Receiver: "notifier1", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(ualert.DisabledRepeatInterval)},
							},
							RepeatInterval: durationPointer(ualert.DisabledRepeatInterval),
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "notifier1", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}},
						},
					},
				},
			},
		},
		{
			name: "when single default channel with SendReminder, use channel Frequency as RepeatInterval",
			legacyChannels: []*models.AlertNotification{
				createAlertNotificationWithReminder(t, int64(1), "notifier1", "email", emailSettings, true, true, time.Duration(1)*time.Hour),
			},
			alerts: []*models.Alert{},
			expected: map[int64]*ualert.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: ualert.PostableApiAlertingConfig{
						Route: &ualert.Route{
							Receiver:   "notifier1",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*ualert.Route{
								{Receiver: "notifier1", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(model.Duration(time.Duration(1) * time.Hour))},
							},
							RepeatInterval: durationPointer(model.Duration(time.Duration(1) * time.Hour)),
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "notifier1", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}},
						},
					},
				},
			},
		},
		{
			name: "when multiple default channels, add them to autogen-contact-point-default as well",
			legacyChannels: []*models.AlertNotification{
				createAlertNotification(t, int64(1), "notifier1", "email", emailSettings, true),
				createAlertNotification(t, int64(1), "notifier2", "slack", slackSettings, true),
			},
			alerts: []*models.Alert{},
			expected: map[int64]*ualert.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: ualert.PostableApiAlertingConfig{
						Route: &ualert.Route{
							Receiver:   "autogen-contact-point-default",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*ualert.Route{
								{Receiver: "notifier1", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(ualert.DisabledRepeatInterval)},
								{Receiver: "notifier2", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier2".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(ualert.DisabledRepeatInterval)},
							},
							RepeatInterval: durationPointer(ualert.DisabledRepeatInterval),
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "notifier1", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}},
							{Name: "notifier2", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier2", Type: "slack"}}},
							{Name: "autogen-contact-point-default", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}, {Name: "notifier2", Type: "slack"}}},
						},
					},
				},
			},
		},
		{
			name: "when multiple default channels with SendReminder, use minimum channel frequency as RepeatInterval",
			legacyChannels: []*models.AlertNotification{
				createAlertNotificationWithReminder(t, int64(1), "notifier1", "email", emailSettings, true, true, time.Duration(1)*time.Hour),
				createAlertNotificationWithReminder(t, int64(1), "notifier2", "slack", slackSettings, true, true, time.Duration(30)*time.Minute),
			},
			alerts: []*models.Alert{},
			expected: map[int64]*ualert.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: ualert.PostableApiAlertingConfig{
						Route: &ualert.Route{
							Receiver:   "autogen-contact-point-default",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*ualert.Route{
								{Receiver: "notifier1", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(model.Duration(time.Duration(1) * time.Hour))},
								{Receiver: "notifier2", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier2".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(model.Duration(time.Duration(30) * time.Minute))},
							},
							RepeatInterval: durationPointer(model.Duration(time.Duration(30) * time.Minute)),
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "notifier1", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}},
							{Name: "notifier2", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier2", Type: "slack"}}},
							{Name: "autogen-contact-point-default", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}, {Name: "notifier2", Type: "slack"}}},
						},
					},
				},
			},
		},
		{
			name: "when default channels exist alongside non-default, add only defaults to autogen-contact-point-default",
			legacyChannels: []*models.AlertNotification{
				createAlertNotification(t, int64(1), "notifier1", "email", emailSettings, true), // default
				createAlertNotification(t, int64(1), "notifier2", "slack", slackSettings, false),
				createAlertNotification(t, int64(1), "notifier3", "opsgenie", opsgenieSettings, true), // default
			},
			alerts: []*models.Alert{},
			expected: map[int64]*ualert.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: ualert.PostableApiAlertingConfig{
						Route: &ualert.Route{
							Receiver:   "autogen-contact-point-default",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*ualert.Route{
								{Receiver: "notifier1", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(ualert.DisabledRepeatInterval)},
								{Receiver: "notifier2", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier2".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(ualert.DisabledRepeatInterval)},
								{Receiver: "notifier3", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier3".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(ualert.DisabledRepeatInterval)},
							},
							RepeatInterval: durationPointer(ualert.DisabledRepeatInterval),
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "notifier1", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}},
							{Name: "notifier2", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier2", Type: "slack"}}},
							{Name: "notifier3", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier3", Type: "opsgenie"}}},
							{Name: "autogen-contact-point-default", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}, {Name: "notifier3", Type: "opsgenie"}}}},
					},
				},
			},
		},
		{
			name: "when alerts share channels, only create one receiver per legacy channel",
			legacyChannels: []*models.AlertNotification{
				createAlertNotification(t, int64(1), "notifier1", "email", emailSettings, false),
				createAlertNotification(t, int64(1), "notifier2", "slack", slackSettings, false),
			},
			alerts: []*models.Alert{
				createAlert(t, int64(1), int64(1), int64(1), "alert1", []string{"notifier1"}),
				createAlert(t, int64(1), int64(1), int64(1), "alert2", []string{"notifier1", "notifier2"}),
			},
			expected: map[int64]*ualert.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: ualert.PostableApiAlertingConfig{
						Route: &ualert.Route{
							Receiver:   "autogen-contact-point-default",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*ualert.Route{
								{Receiver: "notifier1", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(ualert.DisabledRepeatInterval)},
								{Receiver: "notifier2", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier2".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(ualert.DisabledRepeatInterval)},
							},
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "notifier1", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}},
							{Name: "notifier2", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier2", Type: "slack"}}},
							{Name: "autogen-contact-point-default"},
						},
					},
				},
			},
		},
		{
			name: "when channel not linked to any alerts, still create a receiver for it",
			legacyChannels: []*models.AlertNotification{
				createAlertNotification(t, int64(1), "notifier1", "email", emailSettings, false),
			},
			alerts: []*models.Alert{},
			expected: map[int64]*ualert.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: ualert.PostableApiAlertingConfig{
						Route: &ualert.Route{
							Receiver:   "autogen-contact-point-default",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*ualert.Route{
								{Receiver: "notifier1", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(ualert.DisabledRepeatInterval)},
							},
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "notifier1", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}},
							{Name: "autogen-contact-point-default"},
						},
					},
				},
			},
		},
		{
			name: "when unsupported channels, do not migrate them",
			legacyChannels: []*models.AlertNotification{
				createAlertNotification(t, int64(1), "notifier1", "email", emailSettings, false),
				createAlertNotification(t, int64(1), "notifier2", "hipchat", "", false),
				createAlertNotification(t, int64(1), "notifier3", "sensu", "", false),
			},
			alerts: []*models.Alert{},
			expected: map[int64]*ualert.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: ualert.PostableApiAlertingConfig{
						Route: &ualert.Route{
							Receiver:   "autogen-contact-point-default",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*ualert.Route{
								{Receiver: "notifier1", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(ualert.DisabledRepeatInterval)},
							},
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "notifier1", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}},
							{Name: "autogen-contact-point-default"},
						},
					},
				},
			},
		},
		{
			name: "when unsupported channel linked to alert, do not migrate only that channel",
			legacyChannels: []*models.AlertNotification{
				createAlertNotification(t, int64(1), "notifier1", "email", emailSettings, false),
				createAlertNotification(t, int64(1), "notifier2", "sensu", "", false),
			},
			alerts: []*models.Alert{
				createAlert(t, int64(1), int64(1), int64(1), "alert1", []string{"notifier1", "notifier2"}),
			},
			expected: map[int64]*ualert.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: ualert.PostableApiAlertingConfig{
						Route: &ualert.Route{
							Receiver:   "autogen-contact-point-default",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*ualert.Route{
								{Receiver: "notifier1", ObjectMatchers: ualert.ObjectMatchers{{Type: 2, Name: ualert.ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(ualert.DisabledRepeatInterval)},
							},
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "notifier1", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}},
							{Name: "autogen-contact-point-default"},
						},
					},
				},
			},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			defer teardown(t, x)
			setupLegacyAlertsTables(t, x, tt.legacyChannels, tt.alerts)
			runDashAlertMigrationTestRun(t, x)

			for orgId := range tt.expected {
				amConfig := getAlertmanagerConfig(t, x, orgId)

				// Order of nested GrafanaManagedReceivers is not guaranteed.
				cOpt := []cmp.Option{
					cmpopts.IgnoreUnexported(ualert.PostableApiReceiver{}),
					cmpopts.IgnoreFields(ualert.PostableGrafanaReceiver{}, "UID", "Settings", "SecureSettings"),
					cmpopts.SortSlices(func(a, b *ualert.PostableGrafanaReceiver) bool { return a.Name < b.Name }),
					cmpopts.SortSlices(func(a, b *ualert.PostableApiReceiver) bool { return a.Name < b.Name }),
				}
				if !cmp.Equal(tt.expected[orgId].AlertmanagerConfig.Receivers, amConfig.AlertmanagerConfig.Receivers, cOpt...) {
					t.Errorf("Unexpected Receivers: %v", cmp.Diff(tt.expected[orgId].AlertmanagerConfig.Receivers, amConfig.AlertmanagerConfig.Receivers, cOpt...))
				}

				// Order of routes is not guaranteed.
				cOpt = []cmp.Option{
					cmpopts.SortSlices(func(a, b *ualert.Route) bool {
						if a.Receiver != b.Receiver {
							return a.Receiver < b.Receiver
						}
						return a.ObjectMatchers[0].Value < b.ObjectMatchers[0].Value
					}),
					cmpopts.IgnoreUnexported(ualert.Route{}, labels.Matcher{}),
				}
				if !cmp.Equal(tt.expected[orgId].AlertmanagerConfig.Route, amConfig.AlertmanagerConfig.Route, cOpt...) {
					t.Errorf("Unexpected Route: %v", cmp.Diff(tt.expected[orgId].AlertmanagerConfig.Route, amConfig.AlertmanagerConfig.Route, cOpt...))
				}
			}
		})
	}
}

// TestDashAlertMigration tests the execution of the main DashAlertMigration specifically for migrations of models.
func TestDashAlertMigration(t *testing.T) {
	// Run initial migration to have a working DB.
	x := setupTestDB(t)

	t.Run("when DashAlertMigration create ContactLabel on migrated AlertRules", func(t *testing.T) {
		defer teardown(t, x)
		legacyChannels := []*models.AlertNotification{
			createAlertNotification(t, int64(1), "notifier1", "email", emailSettings, false),
			createAlertNotification(t, int64(1), "notifier2", "slack", slackSettings, false),
			createAlertNotification(t, int64(1), "notifier3", "opsgenie", opsgenieSettings, false),
			createAlertNotification(t, int64(2), "notifier4", "email", emailSettings, false),
			createAlertNotification(t, int64(2), "notifier5", "slack", slackSettings, false),
			createAlertNotification(t, int64(2), "notifier6", "opsgenie", opsgenieSettings, true), // default
		}
		alerts := []*models.Alert{
			createAlert(t, int64(1), int64(1), int64(1), "alert1", []string{"notifier1"}),
			createAlert(t, int64(1), int64(1), int64(2), "alert2", []string{"notifier2", "notifier3"}),
			createAlert(t, int64(1), int64(2), int64(3), "alert3", []string{"notifier3"}),
			createAlert(t, int64(2), int64(3), int64(1), "alert4", []string{"notifier4"}),
			createAlert(t, int64(2), int64(3), int64(2), "alert5", []string{"notifier4", "notifier5", "notifier6"}),
			createAlert(t, int64(2), int64(4), int64(3), "alert6", []string{}),
		}
		expected := map[int64]map[string]*ngModels.AlertRule{
			int64(1): {
				"alert1": {Labels: map[string]string{ualert.ContactLabel: `"notifier1"`}},
				"alert2": {Labels: map[string]string{ualert.ContactLabel: `"notifier2","notifier3"`}},
				"alert3": {Labels: map[string]string{ualert.ContactLabel: `"notifier3"`}},
			},
			int64(2): {
				"alert4": {Labels: map[string]string{ualert.ContactLabel: `"notifier4","notifier6"`}},
				"alert5": {Labels: map[string]string{ualert.ContactLabel: `"notifier4","notifier5","notifier6"`}},
				"alert6": {Labels: map[string]string{}},
			},
		}
		setupLegacyAlertsTables(t, x, legacyChannels, alerts)
		runDashAlertMigrationTestRun(t, x)

		for orgId := range expected {
			rules := getAlertRules(t, x, orgId)
			expectedRulesMap := expected[orgId]
			require.Len(t, rules, len(expectedRulesMap))
			for _, r := range rules {
				require.Equal(t, expectedRulesMap[r.Title].Labels[ualert.ContactLabel], r.Labels[ualert.ContactLabel])
			}
		}
	})

	t.Run("when DashAlertMigration create ContactLabel with sanitized name if name contains double quote", func(t *testing.T) {
		defer teardown(t, x)
		legacyChannels := []*models.AlertNotification{
			createAlertNotification(t, int64(1), "notif\"ier1", "email", emailSettings, false),
		}
		alerts := []*models.Alert{
			createAlert(t, int64(1), int64(1), int64(1), "alert1", []string{"notif\"ier1"}),
		}
		expected := map[int64]map[string]*ngModels.AlertRule{
			int64(1): {
				"alert1": {Labels: map[string]string{ualert.ContactLabel: `"notif_ier1"`}},
			},
		}
		setupLegacyAlertsTables(t, x, legacyChannels, alerts)
		runDashAlertMigrationTestRun(t, x)

		for orgId := range expected {
			rules := getAlertRules(t, x, orgId)
			expectedRulesMap := expected[orgId]
			require.Len(t, rules, len(expectedRulesMap))
			for _, r := range rules {
				require.Equal(t, expectedRulesMap[r.Title].Labels[ualert.ContactLabel], r.Labels[ualert.ContactLabel])
			}
		}
	})

	t.Run("when folder is missing put alert in General folder", func(t *testing.T) {
		o := createOrg(t, 1)
		folder1 := createDashboard(t, 1, o.ID, "folder-1")
		folder1.IsFolder = true
		dash1 := createDashboard(t, 3, o.ID, "dash1")
		dash1.FolderID = folder1.ID
		dash2 := createDashboard(t, 4, o.ID, "dash2")
		dash2.FolderID = 22 // missing folder

		a1 := createAlert(t, o.ID, dash1.ID, int64(1), "alert-1", []string{})
		a2 := createAlert(t, o.ID, dash2.ID, int64(1), "alert-2", []string{})

		_, err := x.Insert(o, folder1, dash1, dash2, a1, a2)
		require.NoError(t, err)

		runDashAlertMigrationTestRun(t, x)

		rules := getAlertRules(t, x, o.ID)
		require.Len(t, rules, 2)

		var generalFolder dashboards.Dashboard
		_, err = x.Table(&dashboards.Dashboard{}).Where("title = ? AND org_id = ?", ualert.GENERAL_FOLDER, o.ID).Get(&generalFolder)
		require.NoError(t, err)

		require.NotNil(t, generalFolder)

		for _, rule := range rules {
			var expectedFolder dashboards.Dashboard
			if rule.Title == a1.Name {
				expectedFolder = *folder1
			} else {
				expectedFolder = generalFolder
			}
			require.Equal(t, expectedFolder.UID, rule.NamespaceUID)
		}
	})
}

const (
	emailSettings    = `{"addresses": "test"}`
	slackSettings    = `{"recipient": "test", "token": "test"}`
	opsgenieSettings = `{"apiKey": "test"}`
)

// setupTestDB prepares the sqlite database and runs OSS migrations to initialize the schemas.
func setupTestDB(t *testing.T) *xorm.Engine {
	t.Helper()
	testDB := sqlutil.SQLite3TestDB()

	x, err := xorm.NewEngine(testDB.DriverName, testDB.ConnStr)
	require.NoError(t, err)

	err = migrator.NewDialect(x.DriverName()).CleanDB(x)
	require.NoError(t, err)

	mg := migrator.NewMigrator(x, &setting.Cfg{Raw: ini.Empty()})
	migrations := &migrations.OSSMigrations{}
	migrations.AddMigration(mg)

	err = mg.Start(false, 0)
	require.NoError(t, err)

	return x
}

var (
	now = time.Now()
)

// createAlertNotificationWithReminder creates a legacy alert notification channel for inserting into the test database.
func createAlertNotificationWithReminder(t *testing.T, orgId int64, uid string, channelType string, settings string, defaultChannel bool, sendReminder bool, frequency time.Duration) *models.AlertNotification {
	t.Helper()
	settingsJson := simplejson.New()
	if settings != "" {
		s, err := simplejson.NewJson([]byte(settings))
		if err != nil {
			t.Fatalf("Failed to unmarshal alert notification json: %v", err)
		}
		settingsJson = s
	}

	return &models.AlertNotification{
		OrgID:                 orgId,
		UID:                   uid,
		Name:                  uid, // Same as uid to make testing easier.
		Type:                  channelType,
		DisableResolveMessage: false,
		IsDefault:             defaultChannel,
		Settings:              settingsJson,
		SecureSettings:        make(map[string][]byte),
		Created:               now,
		Updated:               now,
		SendReminder:          sendReminder,
		Frequency:             frequency,
	}
}

// createAlertNotification creates a legacy alert notification channel for inserting into the test database.
func createAlertNotification(t *testing.T, orgId int64, uid string, channelType string, settings string, defaultChannel bool) *models.AlertNotification {
	return createAlertNotificationWithReminder(t, orgId, uid, channelType, settings, defaultChannel, false, time.Duration(0))
}

// createAlert creates a legacy alert rule for inserting into the test database.
func createAlert(t *testing.T, orgId int64, dashboardId int64, panelsId int64, name string, notifierUids []string) *models.Alert {
	t.Helper()

	var settings = simplejson.New()
	if len(notifierUids) != 0 {
		notifiers := make([]interface{}, 0)
		for _, n := range notifierUids {
			notifiers = append(notifiers, struct {
				Uid string
			}{Uid: n})
		}

		settings.Set("notifications", notifiers)
	}

	return &models.Alert{
		OrgID:        orgId,
		DashboardID:  dashboardId,
		PanelID:      panelsId,
		Name:         name,
		Message:      "message",
		Frequency:    int64(60),
		For:          time.Duration(time.Duration(60).Seconds()),
		State:        models.AlertStateOK,
		Settings:     settings,
		NewStateDate: now,
		Created:      now,
		Updated:      now,
	}
}

// createDashboard creates a dashboard for inserting into the test database.
func createDashboard(t *testing.T, id int64, orgId int64, uid string) *dashboards.Dashboard {
	t.Helper()
	return &dashboards.Dashboard{
		ID:      id,
		OrgID:   orgId,
		UID:     uid,
		Created: now,
		Updated: now,
		Title:   uid, // Not tested, needed to satisfy contraint.
	}
}

// createDatasource creates a ddatasource for inserting into the test database.
func createDatasource(t *testing.T, id int64, orgId int64, uid string) *datasources.DataSource {
	t.Helper()
	return &datasources.DataSource{
		ID:      id,
		OrgID:   orgId,
		UID:     uid,
		Created: now,
		Updated: now,
		Name:    uid, // Not tested, needed to satisfy contraint.
	}
}

func createOrg(t *testing.T, id int64) *org.Org {
	t.Helper()
	return &org.Org{
		ID:      id,
		Version: 1,
		Name:    fmt.Sprintf("org_%d", id),
		Created: time.Now(),
		Updated: time.Now(),
	}
}

// teardown cleans the input tables between test cases.
func teardown(t *testing.T, x *xorm.Engine) {
	_, err := x.Exec("DELETE from org")
	require.NoError(t, err)
	_, err = x.Exec("DELETE from alert")
	require.NoError(t, err)
	_, err = x.Exec("DELETE from alert_notification")
	require.NoError(t, err)
	_, err = x.Exec("DELETE from dashboard")
	require.NoError(t, err)
	_, err = x.Exec("DELETE from data_source")
	require.NoError(t, err)
}

// setupDashAlertMigrationTestRun runs DashAlertMigration for a new test run.
func runDashAlertMigrationTestRun(t *testing.T, x *xorm.Engine) {
	_, errDeleteMig := x.Exec("DELETE FROM migration_log WHERE migration_id = ?", ualert.MigTitle)
	require.NoError(t, errDeleteMig)

	alertMigrator := migrator.NewMigrator(x, &setting.Cfg{})
	alertMigrator.AddMigration(ualert.RmMigTitle, &ualert.RmMigration{})
	ualert.AddDashAlertMigration(alertMigrator)

	errRunningMig := alertMigrator.Start(false, 0)
	require.NoError(t, errRunningMig)
}

// setupLegacyAlertsTables inserts data into the legacy alerting tables that is needed for testing the migration.
func setupLegacyAlertsTables(t *testing.T, x *xorm.Engine, legacyChannels []*models.AlertNotification, alerts []*models.Alert) {
	t.Helper()

	orgs := []org.Org{
		*createOrg(t, 1),
		*createOrg(t, 2),
	}

	// Setup dashboards.
	dashboards := []dashboards.Dashboard{
		*createDashboard(t, 1, 1, "dash1-1"),
		*createDashboard(t, 2, 1, "dash2-1"),
		*createDashboard(t, 3, 2, "dash3-2"),
		*createDashboard(t, 4, 2, "dash4-2"),
	}
	_, errDashboards := x.Insert(dashboards)
	require.NoError(t, errDashboards)

	// Setup data_sources.
	dataSources := []datasources.DataSource{
		*createDatasource(t, 1, 1, "ds1-1"),
		*createDatasource(t, 2, 1, "ds2-1"),
		*createDatasource(t, 3, 2, "ds3-2"),
		*createDatasource(t, 4, 2, "ds4-2"),
	}

	_, errOrgs := x.Insert(orgs)
	require.NoError(t, errOrgs)

	_, errDataSourcess := x.Insert(dataSources)
	require.NoError(t, errDataSourcess)

	if len(legacyChannels) > 0 {
		_, channelErr := x.Insert(legacyChannels)
		require.NoError(t, channelErr)
	}

	if len(alerts) > 0 {
		_, alertErr := x.Insert(alerts)
		require.NoError(t, alertErr)
	}
}

// getAlertmanagerConfig retreives the Alertmanager Config from the database for a given orgId.
func getAlertmanagerConfig(t *testing.T, x *xorm.Engine, orgId int64) *ualert.PostableUserConfig {
	amConfig := ""
	_, err := x.Table("alert_configuration").Where("org_id = ?", orgId).Cols("alertmanager_configuration").Get(&amConfig)
	require.NoError(t, err)

	config := ualert.PostableUserConfig{}
	err = json.Unmarshal([]byte(amConfig), &config)
	require.NoError(t, err)
	return &config
}

// getAlertmanagerConfig retreives the Alertmanager Config from the database for a given orgId.
func getAlertRules(t *testing.T, x *xorm.Engine, orgId int64) []*ngModels.AlertRule {
	rules := make([]*ngModels.AlertRule, 0)
	err := x.Table("alert_rule").Where("org_id = ?", orgId).Find(&rules)
	require.NoError(t, err)

	return rules
}

func boolPointer(b bool) *bool {
	return &b
}

func durationPointer(d model.Duration) *model.Duration {
	return &d
}

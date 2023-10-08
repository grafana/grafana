package migration

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

// TestServiceStart tests the wrapper method that decides when to run the migration based on migration status and settings.
func TestServiceStart(t *testing.T) {
	tc := []struct {
		name           string
		config         *setting.Cfg
		isMigrationRun bool
		expectedErr    bool
		expected       bool
	}{
		{
			name: "when unified alerting enabled and migration not already run, then run migration",
			config: &setting.Cfg{
				UnifiedAlerting: setting.UnifiedAlertingSettings{
					Enabled: pointer(true),
				},
			},
			isMigrationRun: false,
			expected:       true,
		},
		{
			name: "when unified alerting disabled, migration is already run and force migration is enabled, then revert migration",
			config: &setting.Cfg{
				UnifiedAlerting: setting.UnifiedAlertingSettings{
					Enabled: pointer(false),
				},
				ForceMigration: true,
			},
			isMigrationRun: true,
			expected:       false,
		},
		{
			name: "when unified alerting disabled, migration is already run and force migration is disabled, then the migration should panic",
			config: &setting.Cfg{
				UnifiedAlerting: setting.UnifiedAlertingSettings{
					Enabled: pointer(false),
				},
				ForceMigration: false,
			},
			isMigrationRun: true,
			expected:       true,
			expectedErr:    true,
		},
		{
			name: "when unified alerting enabled and migration is already run, then do nothing",
			config: &setting.Cfg{
				UnifiedAlerting: setting.UnifiedAlertingSettings{
					Enabled: pointer(true),
				},
			},
			isMigrationRun: true,
			expected:       true,
		},
		{
			name: "when unified alerting disabled and migration is not already run, then do nothing",
			config: &setting.Cfg{
				UnifiedAlerting: setting.UnifiedAlertingSettings{
					Enabled: pointer(false),
				},
			},
			isMigrationRun: false,
			expected:       false,
		},
	}

	sqlStore := db.InitTestDB(t)
	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			service := NewTestMigrationService(t, sqlStore, tt.config)

			err := service.migrationStore.SetMigrated(ctx, tt.isMigrationRun)
			require.NoError(t, err)

			err = service.Run(ctx)
			if tt.expectedErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}

			migrated, err := service.migrationStore.IsMigrated(ctx)
			require.NoError(t, err)
			require.Equal(t, tt.expected, migrated)
		})
	}
}

// TestAMConfigMigration tests the execution of the migration specifically for migrations of channels and routes.
func TestAMConfigMigration(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	x := sqlStore.GetEngine()
	service := NewTestMigrationService(t, sqlStore, &setting.Cfg{})
	tc := []struct {
		name           string
		legacyChannels []*models.AlertNotification
		alerts         []*models.Alert

		expected map[int64]*apimodels.PostableUserConfig
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
				createAlert(t, 1, 1, 1, "alert1", []string{"notifier1"}),
				createAlert(t, 1, 1, 2, "alert2", []string{"notifier2", "notifier3"}),
				createAlert(t, 1, 2, 3, "alert3", []string{"notifier3"}),
				createAlert(t, 2, 3, 1, "alert4", []string{"notifier4"}),
				createAlert(t, 2, 3, 2, "alert5", []string{"notifier4", "notifier5", "notifier6"}),
				createAlert(t, 2, 4, 3, "alert6", []string{}),
			},
			expected: map[int64]*apimodels.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
						Config: apimodels.Config{Route: &apimodels.Route{
							Receiver:   "autogen-contact-point-default",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*apimodels.Route{
								{Receiver: "notifier1", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
								{Receiver: "notifier2", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier2".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
								{Receiver: "notifier3", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier3".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
							},
							RepeatInterval: nil,
						}},
						Receivers: []*apimodels.PostableApiReceiver{
							{Receiver: config.Receiver{Name: "notifier1"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}}},
							{Receiver: config.Receiver{Name: "notifier2"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier2", Type: "slack"}}}},
							{Receiver: config.Receiver{Name: "notifier3"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier3", Type: "opsgenie"}}}},
							{Receiver: config.Receiver{Name: "autogen-contact-point-default"}}, // empty default

						},
					},
				},
				int64(2): {
					AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
						Config: apimodels.Config{Route: &apimodels.Route{
							Receiver:   "notifier6",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*apimodels.Route{
								{Receiver: "notifier4", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier4".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
								{Receiver: "notifier5", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier5".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
								{Receiver: "notifier6", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier6".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
							},
							RepeatInterval: durationPointer(DisabledRepeatInterval),
						}},
						Receivers: []*apimodels.PostableApiReceiver{
							{Receiver: config.Receiver{Name: "notifier4"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier4", Type: "email"}}}},
							{Receiver: config.Receiver{Name: "notifier5"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier5", Type: "slack"}}}},
							{Receiver: config.Receiver{Name: "notifier6"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier6", Type: "opsgenie"}}}},
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
			expected: map[int64]*apimodels.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
						Config: apimodels.Config{Route: &apimodels.Route{
							Receiver:   "autogen-contact-point-default",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*apimodels.Route{
								{Receiver: "notifier1", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
							},
							RepeatInterval: nil,
						}},
						Receivers: []*apimodels.PostableApiReceiver{
							{Receiver: config.Receiver{Name: "notifier1"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}}},
							{Receiver: config.Receiver{Name: "autogen-contact-point-default"}},
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
			expected: map[int64]*apimodels.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
						Config: apimodels.Config{Route: &apimodels.Route{
							Receiver:   "notifier1",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*apimodels.Route{
								{Receiver: "notifier1", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
							},
							RepeatInterval: durationPointer(DisabledRepeatInterval),
						}},
						Receivers: []*apimodels.PostableApiReceiver{
							{Receiver: config.Receiver{Name: "notifier1"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}}},
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
			expected: map[int64]*apimodels.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
						Config: apimodels.Config{Route: &apimodels.Route{
							Receiver:   "notifier1",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*apimodels.Route{
								{Receiver: "notifier1", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(model.Duration(time.Duration(1) * time.Hour))},
							},
							RepeatInterval: durationPointer(model.Duration(time.Duration(1) * time.Hour)),
						}},
						Receivers: []*apimodels.PostableApiReceiver{
							{Receiver: config.Receiver{Name: "notifier1"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}}},
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
			expected: map[int64]*apimodels.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
						Config: apimodels.Config{Route: &apimodels.Route{
							Receiver:   "autogen-contact-point-default",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*apimodels.Route{
								{Receiver: "notifier1", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
								{Receiver: "notifier2", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier2".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
							},
							RepeatInterval: durationPointer(DisabledRepeatInterval),
						}},
						Receivers: []*apimodels.PostableApiReceiver{
							{Receiver: config.Receiver{Name: "notifier1"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}}},
							{Receiver: config.Receiver{Name: "notifier2"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier2", Type: "slack"}}}},
							{Receiver: config.Receiver{Name: "autogen-contact-point-default"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}, {Name: "notifier2", Type: "slack"}}}},
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
			expected: map[int64]*apimodels.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
						Config: apimodels.Config{Route: &apimodels.Route{
							Receiver:   "autogen-contact-point-default",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*apimodels.Route{
								{Receiver: "notifier1", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(model.Duration(time.Duration(1) * time.Hour))},
								{Receiver: "notifier2", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier2".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(model.Duration(time.Duration(30) * time.Minute))},
							},
							RepeatInterval: durationPointer(model.Duration(time.Duration(30) * time.Minute)),
						}},
						Receivers: []*apimodels.PostableApiReceiver{
							{Receiver: config.Receiver{Name: "notifier1"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}}},
							{Receiver: config.Receiver{Name: "notifier2"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier2", Type: "slack"}}}},
							{Receiver: config.Receiver{Name: "autogen-contact-point-default"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}, {Name: "notifier2", Type: "slack"}}}},
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
			expected: map[int64]*apimodels.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
						Config: apimodels.Config{Route: &apimodels.Route{
							Receiver:   "autogen-contact-point-default",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*apimodels.Route{
								{Receiver: "notifier1", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
								{Receiver: "notifier2", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier2".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
								{Receiver: "notifier3", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier3".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
							},
							RepeatInterval: durationPointer(DisabledRepeatInterval),
						}},
						Receivers: []*apimodels.PostableApiReceiver{
							{Receiver: config.Receiver{Name: "notifier1"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}}},
							{Receiver: config.Receiver{Name: "notifier2"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier2", Type: "slack"}}}},
							{Receiver: config.Receiver{Name: "notifier3"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier3", Type: "opsgenie"}}}},
							{Receiver: config.Receiver{Name: "autogen-contact-point-default"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}, {Name: "notifier3", Type: "opsgenie"}}}}},
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
				createAlert(t, 1, 1, 1, "alert1", []string{"notifier1"}),
				createAlert(t, 1, 1, 1, "alert2", []string{"notifier1", "notifier2"}),
			},
			expected: map[int64]*apimodels.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
						Config: apimodels.Config{Route: &apimodels.Route{
							Receiver:   "autogen-contact-point-default",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*apimodels.Route{
								{Receiver: "notifier1", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
								{Receiver: "notifier2", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier2".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
							},
						}},
						Receivers: []*apimodels.PostableApiReceiver{
							{Receiver: config.Receiver{Name: "notifier1"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}}},
							{Receiver: config.Receiver{Name: "notifier2"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier2", Type: "slack"}}}},
							{Receiver: config.Receiver{Name: "autogen-contact-point-default"}},
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
			expected: map[int64]*apimodels.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
						Config: apimodels.Config{Route: &apimodels.Route{
							Receiver:   "autogen-contact-point-default",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*apimodels.Route{
								{Receiver: "notifier1", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
							},
						}},
						Receivers: []*apimodels.PostableApiReceiver{
							{Receiver: config.Receiver{Name: "notifier1"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}}},
							{Receiver: config.Receiver{Name: "autogen-contact-point-default"}},
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
			expected: map[int64]*apimodels.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
						Config: apimodels.Config{Route: &apimodels.Route{
							Receiver:   "autogen-contact-point-default",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*apimodels.Route{
								{Receiver: "notifier1", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
							},
						}},
						Receivers: []*apimodels.PostableApiReceiver{
							{Receiver: config.Receiver{Name: "notifier1"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}}},
							{Receiver: config.Receiver{Name: "autogen-contact-point-default"}},
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
				createAlert(t, 1, 1, 1, "alert1", []string{"notifier1", "notifier2"}),
			},
			expected: map[int64]*apimodels.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
						Config: apimodels.Config{Route: &apimodels.Route{
							Receiver:   "autogen-contact-point-default",
							GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
							Routes: []*apimodels.Route{
								{Receiver: "notifier1", ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"notifier1".*`}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
							},
						}},
						Receivers: []*apimodels.PostableApiReceiver{
							{Receiver: config.Receiver{Name: "notifier1"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}}},
							{Receiver: config.Receiver{Name: "autogen-contact-point-default"}},
						},
					},
				},
			},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			defer teardown(t, x, service)
			setupLegacyAlertsTables(t, x, tt.legacyChannels, tt.alerts, nil, nil)

			err := service.Run(context.Background())
			require.NoError(t, err)

			for orgId := range tt.expected {
				amConfig := getAlertmanagerConfig(t, x, orgId)

				// Order of nested GrafanaManagedReceivers is not guaranteed.
				cOpt := []cmp.Option{
					cmpopts.IgnoreUnexported(apimodels.PostableApiReceiver{}),
					cmpopts.IgnoreFields(apimodels.PostableGrafanaReceiver{}, "UID", "Settings", "SecureSettings"),
					cmpopts.SortSlices(func(a, b *apimodels.PostableGrafanaReceiver) bool { return a.Name < b.Name }),
					cmpopts.SortSlices(func(a, b *apimodels.PostableApiReceiver) bool { return a.Name < b.Name }),
				}
				if !cmp.Equal(tt.expected[orgId].AlertmanagerConfig.Receivers, amConfig.AlertmanagerConfig.Receivers, cOpt...) {
					t.Errorf("Unexpected Receivers: %v", cmp.Diff(tt.expected[orgId].AlertmanagerConfig.Receivers, amConfig.AlertmanagerConfig.Receivers, cOpt...))
				}

				// Order of routes is not guaranteed.
				cOpt = []cmp.Option{
					cmpopts.SortSlices(func(a, b *apimodels.Route) bool {
						if a.Receiver != b.Receiver {
							return a.Receiver < b.Receiver
						}
						return a.ObjectMatchers[0].Value < b.ObjectMatchers[0].Value
					}),
					cmpopts.IgnoreUnexported(apimodels.Route{}, labels.Matcher{}),
					cmpopts.IgnoreFields(apimodels.Route{}, "GroupBy", "GroupByAll"),
				}
				if !cmp.Equal(tt.expected[orgId].AlertmanagerConfig.Route, amConfig.AlertmanagerConfig.Route, cOpt...) {
					t.Errorf("Unexpected Route: %v", cmp.Diff(tt.expected[orgId].AlertmanagerConfig.Route, amConfig.AlertmanagerConfig.Route, cOpt...))
				}
			}
		})
	}
}

// TestDashAlertMigration tests the execution of the migration specifically for alert rules.
func TestDashAlertMigration(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	x := sqlStore.GetEngine()
	service := NewTestMigrationService(t, sqlStore, &setting.Cfg{})

	t.Run("when DashAlertMigration create ContactLabel on migrated AlertRules", func(t *testing.T) {
		defer teardown(t, x, service)
		legacyChannels := []*models.AlertNotification{
			createAlertNotification(t, int64(1), "notifier1", "email", emailSettings, false),
			createAlertNotification(t, int64(1), "notifier2", "slack", slackSettings, false),
			createAlertNotification(t, int64(1), "notifier3", "opsgenie", opsgenieSettings, false),
			createAlertNotification(t, int64(2), "notifier4", "email", emailSettings, false),
			createAlertNotification(t, int64(2), "notifier5", "slack", slackSettings, false),
			createAlertNotification(t, int64(2), "notifier6", "opsgenie", opsgenieSettings, true), // default
		}
		alerts := []*models.Alert{
			createAlert(t, 1, 1, 1, "alert1", []string{"notifier1"}),
			createAlert(t, 1, 1, 2, "alert2", []string{"notifier2", "notifier3"}),
			createAlert(t, 1, 2, 3, "alert3", []string{"notifier3"}),
			createAlert(t, 2, 3, 1, "alert4", []string{"notifier4"}),
			createAlert(t, 2, 3, 2, "alert5", []string{"notifier4", "notifier5", "notifier6"}),
			createAlert(t, 2, 4, 3, "alert6", []string{}),
		}
		expected := map[int64]map[string]*ngModels.AlertRule{
			int64(1): {
				"alert1": {Labels: map[string]string{ContactLabel: `"notifier1"`}},
				"alert2": {Labels: map[string]string{ContactLabel: `"notifier2","notifier3"`}},
				"alert3": {Labels: map[string]string{ContactLabel: `"notifier3"`}},
			},
			int64(2): {
				"alert4": {Labels: map[string]string{ContactLabel: `"notifier4","notifier6"`}},
				"alert5": {Labels: map[string]string{ContactLabel: `"notifier4","notifier5","notifier6"`}},
				"alert6": {Labels: map[string]string{}},
			},
		}
		dashes := []*dashboards.Dashboard{
			createDashboard(t, 1, 1, "dash1-1", 5, nil),
			createDashboard(t, 2, 1, "dash2-1", 5, nil),
			createDashboard(t, 3, 2, "dash3-2", 6, nil),
			createDashboard(t, 4, 2, "dash4-2", 6, nil),
		}
		folders := []*dashboards.Dashboard{
			createFolder(t, 5, 1, "folder5-1"),
			createFolder(t, 6, 2, "folder6-2"),
		}
		setupLegacyAlertsTables(t, x, legacyChannels, alerts, folders, dashes)
		err := service.Run(context.Background())
		require.NoError(t, err)

		for orgId := range expected {
			rules := getAlertRules(t, x, orgId)
			expectedRulesMap := expected[orgId]
			require.Len(t, rules, len(expectedRulesMap))
			for _, r := range rules {
				require.Equal(t, expectedRulesMap[r.Title].Labels[ContactLabel], r.Labels[ContactLabel])
			}
		}
	})

	t.Run("when DashAlertMigration create ContactLabel with sanitized name if name contains double quote", func(t *testing.T) {
		defer teardown(t, x, service)
		legacyChannels := []*models.AlertNotification{
			createAlertNotification(t, int64(1), "notif\"ier1", "email", emailSettings, false),
		}
		alerts := []*models.Alert{
			createAlert(t, 1, 1, 1, "alert1", []string{"notif\"ier1"}),
		}
		expected := map[int64]map[string]*ngModels.AlertRule{
			int64(1): {
				"alert1": {Labels: map[string]string{ContactLabel: `"notif_ier1"`}},
			},
		}
		dashes := []*dashboards.Dashboard{
			createDashboard(t, 1, 1, "dash1-1", 5, nil),
		}
		folders := []*dashboards.Dashboard{
			createFolder(t, 5, 1, "folder5-1"),
		}
		setupLegacyAlertsTables(t, x, legacyChannels, alerts, folders, dashes)
		err := service.Run(context.Background())
		require.NoError(t, err)

		for orgId := range expected {
			rules := getAlertRules(t, x, orgId)
			expectedRulesMap := expected[orgId]
			require.Len(t, rules, len(expectedRulesMap))
			for _, r := range rules {
				require.Equal(t, expectedRulesMap[r.Title].Labels[ContactLabel], r.Labels[ContactLabel])
			}
		}
	})

	t.Run("when folder is missing put alert in General folder", func(t *testing.T) {
		defer teardown(t, x, service)
		o := createOrg(t, 1)
		folder1 := createFolder(t, 1, o.ID, "folder-1")
		dash1 := createDashboard(t, 3, o.ID, "dash1", folder1.ID, nil)
		dash2 := createDashboard(t, 4, o.ID, "dash2", 22, nil) // missing folder

		a1 := createAlert(t, int(o.ID), int(dash1.ID), 1, "alert-1", []string{})
		a2 := createAlert(t, int(o.ID), int(dash2.ID), 1, "alert-2", []string{})

		_, err := x.Insert(o, folder1, dash1, dash2, a1, a2)
		require.NoError(t, err)

		err = service.Run(context.Background())
		require.NoError(t, err)

		rules := getAlertRules(t, x, o.ID)
		require.Len(t, rules, 2)

		var generalFolder dashboards.Dashboard
		_, err = x.Table(&dashboards.Dashboard{}).Where("title = ? AND org_id = ?", generalAlertingFolderTitle, o.ID).Get(&generalFolder)
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

// TestDashAlertQueryMigration tests the execution of the migration specifically for alert rule queries.
func TestDashAlertQueryMigration(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	x := sqlStore.GetEngine()
	service := NewTestMigrationService(t, sqlStore, &setting.Cfg{})

	createAlertQuery := func(refId string, ds string, from string, to string) ngModels.AlertQuery {
		dur, _ := calculateInterval(legacydata.NewDataTimeRange(from, to), simplejson.New(), nil)
		intervalMs := strconv.FormatInt(dur.Milliseconds(), 10)
		rel, _ := getRelativeDuration(from, to)
		return ngModels.AlertQuery{
			RefID:             refId,
			RelativeTimeRange: ngModels.RelativeTimeRange{From: rel.From, To: rel.To},
			DatasourceUID:     ds,
			Model:             []byte(fmt.Sprintf(`{"datasource":{"type":"prometheus","uid":"gdev-prometheus"},"expr":"up{job=\"fake-data-gen\"}","instant":false,"intervalMs":%s,"maxDataPoints":1500,"refId":"%s"}`, intervalMs, refId)),
		}
	}

	createClassicConditionQuery := func(refId string, conditions []classicConditionJSON) ngModels.AlertQuery {
		exprModel := struct {
			Type       string                 `json:"type"`
			RefID      string                 `json:"refId"`
			Conditions []classicConditionJSON `json:"conditions"`
		}{
			"classic_conditions",
			refId,
			conditions,
		}
		exprModelJSON, _ := json.Marshal(&exprModel)

		q := ngModels.AlertQuery{
			RefID:         refId,
			DatasourceUID: expressionDatasourceUID,
			Model:         exprModelJSON,
		}
		// IntervalMS and MaxDataPoints are created PreSave by AlertQuery. They don't appear to be necessary for expressions,
		// but run PreSave here to match the expected model.
		_ = q.PreSave()
		return q
	}

	cond := func(refId string, reducer string, evalType string, thresh float64) classicConditionJSON {
		return classicConditionJSON{
			Evaluator: migrationStore.ConditionEvalJSON{Params: []float64{thresh}, Type: evalType},
			Operator: struct {
				Type string `json:"type"`
			}{Type: "and"},
			Query: struct {
				Params []string `json:"params"`
			}{Params: []string{refId}},
			Reducer: struct {
				Type string `json:"type"`
			}{Type: reducer},
		}
	}

	genAlert := func(mutators ...ngModels.AlertRuleMutator) *ngModels.AlertRule {
		rule := &ngModels.AlertRule{
			ID:              1,
			OrgID:           1,
			Title:           "alert1",
			Condition:       "B",
			Data:            []ngModels.AlertQuery{},
			IntervalSeconds: 60,
			Version:         1,
			NamespaceUID:    "folder5-1",
			DashboardUID:    pointer("dash1-1"),
			PanelID:         pointer(int64(1)),
			RuleGroup:       "alert1",
			RuleGroupIndex:  1,
			NoDataState:     ngModels.NoData,
			ExecErrState:    ngModels.AlertingErrState,
			For:             60 * time.Second,
			Annotations: map[string]string{
				"message": "message",
			},
			Labels:   map[string]string{},
			IsPaused: false,
		}

		for _, mutator := range mutators {
			mutator(rule)
		}

		rule.Annotations["__dashboardUid__"] = *rule.DashboardUID
		rule.Annotations["__panelId__"] = strconv.FormatInt(*rule.PanelID, 10)
		return rule
	}

	type testcase struct {
		name   string
		alerts []*models.Alert

		expectedFolder *dashboards.Dashboard
		expected       map[int64][]*ngModels.AlertRule
	}

	tc := []testcase{
		{
			name: "simple query and condition",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 1, 1, "alert1", nil,
					[]migrationStore.DashAlertCondition{createCondition("A", "max", "gt", 42, 1, "5m", "now")}),
				createAlertWithCond(t, 2, 3, 1, "alert1", nil,
					[]migrationStore.DashAlertCondition{createCondition("A", "max", "gt", 42, 3, "5m", "now")}),
			},
			expected: map[int64][]*ngModels.AlertRule{
				int64(1): {
					genAlert(func(rule *ngModels.AlertRule) {
						rule.Data = append(rule.Data, createAlertQuery("A", "ds1-1", "5m", "now"))
						rule.Data = append(rule.Data, createClassicConditionQuery("B", []classicConditionJSON{
							cond("A", "max", "gt", 42),
						}))
					}),
				},
				int64(2): {
					genAlert(func(rule *ngModels.AlertRule) {
						rule.OrgID = 2
						rule.DashboardUID = pointer("dash3-2")
						rule.NamespaceUID = "folder6-2"
						rule.Data = append(rule.Data, createAlertQuery("A", "ds3-2", "5m", "now"))
						rule.Data = append(rule.Data, createClassicConditionQuery("B", []classicConditionJSON{
							cond("A", "max", "gt", 42),
						}))
					}),
				},
			},
		},
		{
			name: "multiple conditions",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 1, 1, "alert1", nil,
					[]migrationStore.DashAlertCondition{
						createCondition("A", "avg", "gt", 42, 1, "5m", "now"),
						createCondition("B", "max", "gt", 43, 2, "3m", "now"),
						createCondition("C", "min", "lt", 20, 2, "3m", "now"),
					}),
			},
			expected: map[int64][]*ngModels.AlertRule{
				int64(1): {
					genAlert(func(rule *ngModels.AlertRule) {
						rule.Condition = "D"
						rule.Data = append(rule.Data, createAlertQuery("A", "ds1-1", "5m", "now"))
						rule.Data = append(rule.Data, createAlertQuery("B", "ds2-1", "3m", "now"))
						rule.Data = append(rule.Data, createAlertQuery("C", "ds2-1", "3m", "now"))
						rule.Data = append(rule.Data, createClassicConditionQuery("D", []classicConditionJSON{
							cond("A", "avg", "gt", 42),
							cond("B", "max", "gt", 43),
							cond("C", "min", "lt", 20),
						}))
					}),
				},
			},
		},
		{
			name: "multiple conditions on same query with same timerange should not create multiple queries",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 1, 1, "alert1", nil,
					[]migrationStore.DashAlertCondition{
						createCondition("A", "max", "gt", 42, 1, "5m", "now"),
						createCondition("A", "avg", "gt", 20, 1, "5m", "now"),
					}),
			},
			expected: map[int64][]*ngModels.AlertRule{
				int64(1): {
					genAlert(func(rule *ngModels.AlertRule) {
						rule.Condition = "B"
						rule.Data = append(rule.Data, createAlertQuery("A", "ds1-1", "5m", "now"))
						rule.Data = append(rule.Data, createClassicConditionQuery("B", []classicConditionJSON{
							cond("A", "max", "gt", 42),
							cond("A", "avg", "gt", 20),
						}))
					}),
				},
			},
		},
		{
			name: "multiple conditions on same query with different timeranges should create multiple queries",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 1, 1, "alert1", nil,
					[]migrationStore.DashAlertCondition{
						createCondition("A", "max", "gt", 42, 1, "5m", "now"),
						createCondition("A", "avg", "gt", 20, 1, "3m", "now"),
					}),
			},
			expected: map[int64][]*ngModels.AlertRule{
				int64(1): {
					genAlert(func(rule *ngModels.AlertRule) {
						rule.Condition = "C"
						rule.Data = append(rule.Data, createAlertQuery("A", "ds1-1", "3m", "now")) // Ordered by time range.
						rule.Data = append(rule.Data, createAlertQuery("B", "ds1-1", "5m", "now"))
						rule.Data = append(rule.Data, createClassicConditionQuery("C", []classicConditionJSON{
							cond("B", "max", "gt", 42),
							cond("A", "avg", "gt", 20),
						}))
					}),
				},
			},
		},
		{
			name: "multiple conditions custom refIds",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 1, 1, "alert1", nil,
					[]migrationStore.DashAlertCondition{
						createCondition("Q1", "avg", "gt", 42, 1, "5m", "now"),
						createCondition("Q2", "max", "gt", 43, 2, "3m", "now"),
						createCondition("Q3", "min", "lt", 20, 2, "3m", "now"),
					}),
			},
			expected: map[int64][]*ngModels.AlertRule{
				int64(1): {
					genAlert(func(rule *ngModels.AlertRule) {
						rule.Condition = "A"
						rule.Data = append(rule.Data, createClassicConditionQuery("A", []classicConditionJSON{
							cond("Q1", "avg", "gt", 42),
							cond("Q2", "max", "gt", 43),
							cond("Q3", "min", "lt", 20),
						}))
						rule.Data = append(rule.Data, createAlertQuery("Q1", "ds1-1", "5m", "now"))
						rule.Data = append(rule.Data, createAlertQuery("Q2", "ds2-1", "3m", "now"))
						rule.Data = append(rule.Data, createAlertQuery("Q3", "ds2-1", "3m", "now"))
					}),
				},
			},
		},
		{
			name: "multiple conditions out of order refIds, queries should be sorted by refId and conditions should be in original order",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 1, 1, "alert1", nil,
					[]migrationStore.DashAlertCondition{
						createCondition("B", "avg", "gt", 42, 1, "5m", "now"),
						createCondition("C", "max", "gt", 43, 2, "3m", "now"),
						createCondition("A", "min", "lt", 20, 2, "3m", "now"),
					}),
			},
			expected: map[int64][]*ngModels.AlertRule{
				int64(1): {
					genAlert(func(rule *ngModels.AlertRule) {
						rule.Condition = "D"
						rule.Data = append(rule.Data, createAlertQuery("A", "ds2-1", "3m", "now"))
						rule.Data = append(rule.Data, createAlertQuery("B", "ds1-1", "5m", "now"))
						rule.Data = append(rule.Data, createAlertQuery("C", "ds2-1", "3m", "now"))
						rule.Data = append(rule.Data, createClassicConditionQuery("D", []classicConditionJSON{
							cond("B", "avg", "gt", 42),
							cond("C", "max", "gt", 43),
							cond("A", "min", "lt", 20),
						}))
					}),
				},
			},
		},
		{
			name: "multiple conditions out of order with duplicate refIds",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 1, 1, "alert1", nil,
					[]migrationStore.DashAlertCondition{
						createCondition("C", "avg", "gt", 42, 1, "5m", "now"),
						createCondition("C", "max", "gt", 43, 1, "3m", "now"),
						createCondition("B", "min", "lt", 20, 2, "5m", "now"),
						createCondition("B", "min", "lt", 21, 2, "3m", "now"),
					}),
			},
			expected: map[int64][]*ngModels.AlertRule{
				int64(1): {
					genAlert(func(rule *ngModels.AlertRule) {
						rule.Condition = "E"
						rule.Data = append(rule.Data, createAlertQuery("A", "ds2-1", "3m", "now"))
						rule.Data = append(rule.Data, createAlertQuery("B", "ds2-1", "5m", "now"))
						rule.Data = append(rule.Data, createAlertQuery("C", "ds1-1", "3m", "now"))
						rule.Data = append(rule.Data, createAlertQuery("D", "ds1-1", "5m", "now"))
						rule.Data = append(rule.Data, createClassicConditionQuery("E", []classicConditionJSON{
							cond("D", "avg", "gt", 42),
							cond("C", "max", "gt", 43),
							cond("B", "min", "lt", 20),
							cond("A", "min", "lt", 21),
						}))
					}),
				},
			},
		},
		{
			name: "alerts with unknown datasource id migrates with empty datasource uid",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 1, 1, "alert1", nil,
					[]migrationStore.DashAlertCondition{createCondition("A", "max", "gt", 42, 123, "5m", "now")}), // Unknown datasource id.
			},
			expected: map[int64][]*ngModels.AlertRule{
				int64(1): {
					genAlert(func(rule *ngModels.AlertRule) {
						rule.Data = append(rule.Data, createAlertQuery("A", "", "5m", "now")) // Empty datasource UID.
						rule.Data = append(rule.Data, createClassicConditionQuery("B", []classicConditionJSON{
							cond("A", "max", "gt", 42),
						}))
					}),
				},
			},
		},
		{
			name: "alerts with unknown dashboard do not migrate",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 22, 1, "alert1", nil,
					[]migrationStore.DashAlertCondition{
						createCondition("A", "avg", "gt", 42, 1, "5m", "now"),
					}),
			},
			expected: map[int64][]*ngModels.AlertRule{
				int64(1): {},
			},
		},
		{
			name: "alerts with unknown org do not migrate",
			alerts: []*models.Alert{
				createAlertWithCond(t, 22, 1, 1, "alert1", nil,
					[]migrationStore.DashAlertCondition{
						createCondition("A", "avg", "gt", 42, 1, "5m", "now"),
					}),
			},
			expected: map[int64][]*ngModels.AlertRule{
				int64(22): {},
			},
		},
		{
			name: "alerts in general folder migrate to existing general alerting",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 8, 1, "alert1", nil,
					[]migrationStore.DashAlertCondition{
						createCondition("A", "avg", "gt", 42, 1, "5m", "now"),
					}),
			},
			expected: map[int64][]*ngModels.AlertRule{
				int64(1): {
					genAlert(func(rule *ngModels.AlertRule) {
						rule.NamespaceUID = "General Alerting"
						rule.DashboardUID = pointer("dash-in-general-1")
						rule.Data = append(rule.Data, createAlertQuery("A", "ds1-1", "5m", "now"))
						rule.Data = append(rule.Data, createClassicConditionQuery("B", []classicConditionJSON{
							cond("A", "avg", "gt", 42),
						}))
					}),
				},
			},
		},
		{
			name: "alerts in general folder migrate to newly created general alerting if one doesn't exist",
			alerts: []*models.Alert{
				createAlertWithCond(t, 2, 9, 1, "alert1", nil, // Org 2 doesn't have general alerting folder.
					[]migrationStore.DashAlertCondition{
						createCondition("A", "avg", "gt", 42, 3, "5m", "now"),
					}),
			},
			expectedFolder: &dashboards.Dashboard{
				OrgID:    2,
				Title:    "General Alerting",
				FolderID: 0,
				Slug:     "general-alerting",
			},
			expected: map[int64][]*ngModels.AlertRule{
				int64(2): {
					genAlert(func(rule *ngModels.AlertRule) {
						rule.OrgID = 2
						rule.DashboardUID = pointer("dash-in-general-2")
						rule.Data = append(rule.Data, createAlertQuery("A", "ds3-2", "5m", "now"))
						rule.Data = append(rule.Data, createClassicConditionQuery("B", []classicConditionJSON{
							cond("A", "avg", "gt", 42),
						}))
					}),
				},
			},
		},
	}
	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			defer teardown(t, x, service)
			dashes := []*dashboards.Dashboard{
				createDashboard(t, 1, 1, "dash1-1", 5, nil),
				createDashboard(t, 2, 1, "dash2-1", 5, nil),
				createDashboard(t, 3, 2, "dash3-2", 6, nil),
				createDashboard(t, 4, 2, "dash4-2", 6, nil),
				createDashboard(t, 8, 1, "dash-in-general-1", 0, nil),
				createDashboard(t, 9, 2, "dash-in-general-2", 0, nil),
				createDashboard(t, 10, 1, "dash-with-acl-1", 5, func(d *dashboards.Dashboard) {
					d.Title = "Dashboard With ACL 1"
					d.HasACL = true
				}),
			}
			folders := []*dashboards.Dashboard{
				createFolder(t, 5, 1, "folder5-1"),
				createFolder(t, 6, 2, "folder6-2"),
				createFolder(t, 7, 1, "General Alerting"),
			}
			setupLegacyAlertsTables(t, x, nil, tt.alerts, folders, dashes)

			err := service.Run(context.Background())
			require.NoError(t, err)

			for orgId, expected := range tt.expected {
				rules := getAlertRules(t, x, orgId)

				for _, r := range rules {
					// Remove generated fields.
					require.NotEqual(t, r.Labels["rule_uid"], "")
					delete(r.Labels, "rule_uid")
					require.NotEqual(t, r.Annotations["__alertId__"], "")
					delete(r.Annotations, "__alertId__")

					// If folder is created, we check if separately
					if tt.expectedFolder != nil {
						folder := getDashboard(t, x, orgId, r.NamespaceUID)
						require.Equal(t, tt.expectedFolder.Title, folder.Title)
						require.Equal(t, tt.expectedFolder.OrgID, folder.OrgID)
						require.Equal(t, tt.expectedFolder.FolderID, folder.FolderID)
					}
				}

				cOpt := []cmp.Option{
					cmpopts.SortSlices(func(a, b *ngModels.AlertRule) bool {
						return a.ID < b.ID
					}),
					cmpopts.IgnoreUnexported(ngModels.AlertRule{}, ngModels.AlertQuery{}),
					cmpopts.IgnoreFields(ngModels.AlertRule{}, "Updated", "UID", "ID"),
				}
				if tt.expectedFolder != nil {
					cOpt = append(cOpt, cmpopts.IgnoreFields(ngModels.AlertRule{}, "NamespaceUID"))
				}
				if !cmp.Equal(expected, rules, cOpt...) {
					t.Errorf("Unexpected Rule: %v", cmp.Diff(expected, rules, cOpt...))
				}
			}
		})
	}
}

const (
	emailSettings    = `{"addresses": "test"}`
	slackSettings    = `{"recipient": "test", "token": "test"}`
	opsgenieSettings = `{"apiKey": "test"}`
)

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

var queryModel = `{"datasource":{"type":"prometheus","uid":"gdev-prometheus"},"expr":"up{job=\"fake-data-gen\"}","instant":false,"refId":"%s"}`

func createCondition(refId string, reducer string, evalType string, thresh float64, datasourceId int64, from string, to string) migrationStore.DashAlertCondition {
	return migrationStore.DashAlertCondition{
		Evaluator: migrationStore.ConditionEvalJSON{
			Params: []float64{thresh},
			Type:   evalType,
		},
		Operator: struct {
			Type string `json:"type"`
		}{
			Type: "and",
		},
		Query: struct {
			Params       []string `json:"params"`
			DatasourceID int64    `json:"datasourceId"`
			Model        json.RawMessage
		}{
			Params:       []string{refId, from, to},
			DatasourceID: datasourceId,
			Model:        []byte(fmt.Sprintf(queryModel, refId)),
		},
		Reducer: struct {
			Type string `json:"type"`
		}{
			Type: reducer,
		},
	}
}

// createAlert creates a legacy alert rule for inserting into the test database.
func createAlert(t *testing.T, orgId int, dashboardId int, panelsId int, name string, notifierUids []string) *models.Alert {
	return createAlertWithCond(t, orgId, dashboardId, panelsId, name, notifierUids, []migrationStore.DashAlertCondition{})
}

// createAlert creates a legacy alert rule for inserting into the test database.
func createAlertWithCond(t *testing.T, orgId int, dashboardId int, panelsId int, name string, notifierUids []string, cond []migrationStore.DashAlertCondition) *models.Alert {
	t.Helper()

	var settings = simplejson.New()
	if len(notifierUids) != 0 {
		notifiers := make([]any, 0)
		for _, n := range notifierUids {
			notifiers = append(notifiers, struct {
				Uid string
			}{Uid: n})
		}

		settings.Set("notifications", notifiers)
	}
	settings.Set("conditions", cond)

	return &models.Alert{
		OrgID:        int64(orgId),
		DashboardID:  int64(dashboardId),
		PanelID:      int64(panelsId),
		Name:         name,
		Message:      "message",
		Frequency:    int64(60),
		For:          60 * time.Second,
		State:        models.AlertStateOK,
		Settings:     settings,
		NewStateDate: now,
		Created:      now,
		Updated:      now,
	}
}

// createDashboard creates a folder for inserting into the test database.
func createFolder(t *testing.T, id int64, orgId int64, uid string) *dashboards.Dashboard {
	f := createDashboard(t, id, orgId, uid, 0, nil)
	f.IsFolder = true
	return f
}

// createDashboard creates a dashboard for inserting into the test database.
func createDashboard(t *testing.T, id int64, orgId int64, uid string, folderId int64, mut func(*dashboards.Dashboard)) *dashboards.Dashboard {
	t.Helper()
	d := &dashboards.Dashboard{
		ID:       id,
		OrgID:    orgId,
		UID:      uid,
		Created:  now,
		Updated:  now,
		Title:    uid, // Not tested, needed to satisfy constraint.
		FolderID: folderId,
		Data:     simplejson.New(),
		Version:  1,
	}
	if mut != nil {
		mut(d)
	}
	return d
}

// createDatasource creates a datasource for inserting into the test database.
func createDatasource(t *testing.T, id int64, orgId int64, uid string) *datasources.DataSource {
	t.Helper()
	return &datasources.DataSource{
		ID:      id,
		OrgID:   orgId,
		UID:     uid,
		Created: now,
		Updated: now,
		Name:    uid, // Not tested, needed to satisfy constraint.
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
func teardown(t *testing.T, x *xorm.Engine, service *MigrationService) {
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
	err = service.migrationStore.RevertAllOrgs(context.Background())
	require.NoError(t, err)
}

// setupLegacyAlertsTables inserts data into the legacy alerting tables that is needed for testing the
func setupLegacyAlertsTables(t *testing.T, x *xorm.Engine, legacyChannels []*models.AlertNotification, alerts []*models.Alert, folders []*dashboards.Dashboard, dashes []*dashboards.Dashboard) {
	t.Helper()

	orgs := []org.Org{
		*createOrg(t, 1),
		*createOrg(t, 2),
	}

	// Setup folders.
	if len(folders) > 0 {
		_, err := x.Insert(folders)
		require.NoError(t, err)
	}

	// Setup dashboards.
	if len(dashes) > 0 {
		_, err := x.Insert(dashes)
		require.NoError(t, err)
	}

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
func getAlertmanagerConfig(t *testing.T, x *xorm.Engine, orgId int64) *apimodels.PostableUserConfig {
	amConfig := ""
	_, err := x.Table("alert_configuration").Where("org_id = ?", orgId).Cols("alertmanager_configuration").Get(&amConfig)
	require.NoError(t, err)

	config := apimodels.PostableUserConfig{}
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

// getDashboard retrieves a dashboard from the database for a given org, uid.
func getDashboard(t *testing.T, x *xorm.Engine, orgId int64, uid string) *dashboards.Dashboard {
	dashes := make([]*dashboards.Dashboard, 0)
	err := x.Table("dashboard").Where("org_id = ? AND uid = ?", orgId, uid).Find(&dashes)
	require.NoError(t, err)
	if len(dashes) > 1 {
		t.Error("Expected only one dashboard to be returned")
	}
	if len(dashes) == 0 {
		return nil
	}

	return dashes[0]
}

func pointer[T any](b T) *T {
	return &b
}

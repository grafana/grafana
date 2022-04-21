package ualert_test

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/require"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
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

// TestDashAlertMigration tests the execution of the main DashAlertMigration.
func TestDashAlertMigration(t *testing.T) {
	// Run initial migration to have a working DB.
	x := setupTestDB(t)

	emailSettings := `{"addresses": "test"}`
	slackSettings := `{"recipient": "test", "token": "test"}`
	opsgenieSettings := `{"apiKey": "test"}`

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
							Receiver: "autogen-contact-point-default",
							Routes: []*ualert.Route{
								{Receiver: "autogen-contact-point-1", Matchers: newMatchers(labels.MatchEqual, "alert_name", "alert1")}, // These Matchers are temporary and will be replaced below with generated rule_uid.
								{Receiver: "autogen-contact-point-2", Matchers: newMatchers(labels.MatchEqual, "alert_name", "alert2")},
								{Receiver: "autogen-contact-point-3", Matchers: newMatchers(labels.MatchEqual, "alert_name", "alert3")},
							},
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "autogen-contact-point-1", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}},                                        // email
							{Name: "autogen-contact-point-2", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier2", Type: "slack"}, {Name: "notifier3", Type: "opsgenie"}}}, // slack+opsgenie
							{Name: "autogen-contact-point-3", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier3", Type: "opsgenie"}}},                                     // opsgenie
							{Name: "autogen-contact-point-default"}, // empty default
						},
					},
				},
				int64(2): {
					AlertmanagerConfig: ualert.PostableApiAlertingConfig{
						Route: &ualert.Route{
							Receiver: "autogen-contact-point-default",
							Routes: []*ualert.Route{
								{Receiver: "autogen-contact-point-4", Matchers: newMatchers(labels.MatchEqual, "alert_name", "alert4")},
								{Receiver: "autogen-contact-point-5", Matchers: newMatchers(labels.MatchEqual, "alert_name", "alert5")},
							},
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "autogen-contact-point-4", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier4", Type: "email"}, {Name: "notifier6", Type: "opsgenie"}}},                                     // email
							{Name: "autogen-contact-point-5", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier4", Type: "email"}, {Name: "notifier5", Type: "slack"}, {Name: "notifier6", Type: "opsgenie"}}}, // email+slack+opsgenie
							{Name: "autogen-contact-point-default", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier6", Type: "opsgenie"}}},                                                                   // empty default
						},
					},
				},
			},
		},
		{
			name: "when default channel, add to autogen-contact-point-default",
			legacyChannels: []*models.AlertNotification{
				createAlertNotification(t, int64(1), "notifier1", "email", emailSettings, true), // default
			},
			alerts: []*models.Alert{
				createAlert(t, int64(1), int64(1), int64(1), "alert1", []string{"notifier1"}),
			},
			expected: map[int64]*ualert.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: ualert.PostableApiAlertingConfig{
						Route: &ualert.Route{
							Receiver: "autogen-contact-point-default",
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "autogen-contact-point-default", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}},
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
			alerts: []*models.Alert{
				createAlert(t, int64(1), int64(1), int64(1), "alert1", []string{"notifier2"}), // + notifier1, notifier3
			},
			expected: map[int64]*ualert.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: ualert.PostableApiAlertingConfig{
						Route: &ualert.Route{
							Receiver: "autogen-contact-point-default",
							Routes: []*ualert.Route{
								{Receiver: "autogen-contact-point-1", Matchers: newMatchers(labels.MatchEqual, "alert_name", "alert1")},
							},
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "autogen-contact-point-1", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}, {Name: "notifier2", Type: "slack"}, {Name: "notifier3", Type: "opsgenie"}}},
							{Name: "autogen-contact-point-default", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}, {Name: "notifier3", Type: "opsgenie"}}},
						},
					},
				},
			},
		},
		{
			name: "when alert has only defaults, don't create route for it",
			legacyChannels: []*models.AlertNotification{
				createAlertNotification(t, int64(1), "notifier1", "email", emailSettings, true), // default
				createAlertNotification(t, int64(1), "notifier2", "slack", slackSettings, true), // default
			},
			alerts: []*models.Alert{
				createAlert(t, int64(1), int64(1), int64(1), "alert1", []string{"notifier1"}),
				createAlert(t, int64(1), int64(2), int64(3), "alert2", []string{}),
			},
			expected: map[int64]*ualert.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: ualert.PostableApiAlertingConfig{
						Route: &ualert.Route{
							Receiver: "autogen-contact-point-default",
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "autogen-contact-point-default", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}, {Name: "notifier2", Type: "slack"}}},
						},
					},
				},
			},
		},
		{
			name: "when alerts share all channels, only create one receiver for all of them",
			legacyChannels: []*models.AlertNotification{
				createAlertNotification(t, int64(1), "notifier1", "email", emailSettings, false),
				createAlertNotification(t, int64(1), "notifier2", "slack", slackSettings, false),
			},
			alerts: []*models.Alert{
				createAlert(t, int64(1), int64(1), int64(1), "alert1", []string{"notifier1", "notifier2"}),
				createAlert(t, int64(1), int64(1), int64(1), "alert2", []string{"notifier1", "notifier2"}),
			},
			expected: map[int64]*ualert.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: ualert.PostableApiAlertingConfig{
						Route: &ualert.Route{
							Receiver: "autogen-contact-point-default",
							Routes: []*ualert.Route{
								{Receiver: "autogen-contact-point-1", Matchers: newMatchers(labels.MatchEqual, "alert_name", "alert1")},
								{Receiver: "autogen-contact-point-1", Matchers: newMatchers(labels.MatchEqual, "alert_name", "alert2")},
							},
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "autogen-contact-point-1", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}, {Name: "notifier2", Type: "slack"}}},
							{Name: "autogen-contact-point-default"},
						},
					},
				},
			},
		},
		{
			name: "when channel not linked to any alerts, migrate it to autogen-unlinked-channel-recv",
			legacyChannels: []*models.AlertNotification{
				createAlertNotification(t, int64(1), "notifier1", "email", emailSettings, true),        // default
				createAlertNotification(t, int64(1), "notifier2", "slack", slackSettings, true),        // default
				createAlertNotification(t, int64(1), "notifier3", "opsgenie", opsgenieSettings, false), // unlinked
			},
			alerts: []*models.Alert{
				createAlert(t, int64(1), int64(1), int64(1), "alert1", []string{"notifier1"}),
				createAlert(t, int64(1), int64(2), int64(3), "alert3", []string{}),
			},
			expected: map[int64]*ualert.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: ualert.PostableApiAlertingConfig{
						Route: &ualert.Route{
							Receiver: "autogen-contact-point-default",
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "autogen-contact-point-default", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}, {Name: "notifier2", Type: "slack"}}},
							{Name: "autogen-unlinked-channel-recv", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier3", Type: "opsgenie"}}},
						},
					},
				},
			},
		},
		{
			name: "when unsupported channels, do not migrate them",
			legacyChannels: []*models.AlertNotification{
				createAlertNotification(t, int64(1), "notifier1", "hipchat", "", false),
				createAlertNotification(t, int64(1), "notifier2", "sensu", "", false),
			},
			alerts: []*models.Alert{},
			expected: map[int64]*ualert.PostableUserConfig{
				int64(1): {
					AlertmanagerConfig: ualert.PostableApiAlertingConfig{
						Route: &ualert.Route{
							Receiver: "autogen-contact-point-default",
						},
						Receivers: []*ualert.PostableApiReceiver{
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
							Receiver: "autogen-contact-point-default",
							Routes: []*ualert.Route{
								{Receiver: "autogen-contact-point-1", Matchers: newMatchers(labels.MatchEqual, "alert_name", "alert1")},
							},
						},
						Receivers: []*ualert.PostableApiReceiver{
							{Name: "autogen-contact-point-1", GrafanaManagedReceivers: []*ualert.PostableGrafanaReceiver{{Name: "notifier1", Type: "email"}}}, // no sensu
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

			_, errDeleteMig := x.Exec("DELETE FROM migration_log WHERE migration_id = ?", ualert.MigTitle)
			require.NoError(t, errDeleteMig)

			alertMigrator := migrator.NewMigrator(x, &setting.Cfg{})
			alertMigrator.AddMigration(ualert.RmMigTitle, &ualert.RmMigration{})
			ualert.AddDashAlertMigration(alertMigrator)

			errRunningMig := alertMigrator.Start(false, 0)
			require.NoError(t, errRunningMig)

			for orgId := range tt.expected {
				amConfig := getAlertmanagerConfig(t, x, orgId)

				// Order of nested GrafanaManagedReceivers is not guaranteed.
				cOpt := []cmp.Option{
					cmpopts.IgnoreFields(ualert.PostableGrafanaReceiver{}, "UID", "Settings", "SecureSettings"),
					cmpopts.SortSlices(func(a, b *ualert.PostableGrafanaReceiver) bool { return a.Name < b.Name }),
					cmpopts.SortSlices(func(a, b *ualert.PostableApiReceiver) bool { return a.Name < b.Name }),
				}
				if !cmp.Equal(tt.expected[orgId].AlertmanagerConfig.Receivers, amConfig.AlertmanagerConfig.Receivers, cOpt...) {
					t.Errorf("Unexpected Receivers: %v", cmp.Diff(tt.expected[orgId].AlertmanagerConfig.Receivers, amConfig.AlertmanagerConfig.Receivers, cOpt...))
				}

				// Since routes and alerts are connecting solely by the Matchers on rule_uid, which is created at runtime we need to do some prep-work to populate the expected Matchers.
				alertUids := getAlertNameToUidMap(t, x, orgId)
				replaceAlertNameMatcherWithRuleUid(t, tt.expected[orgId].AlertmanagerConfig.Route.Routes, alertUids)

				// Order of nested routes is not guaranteed.
				cOpt = []cmp.Option{
					cmpopts.SortSlices(func(a, b *ualert.Route) bool { return a.Receiver < b.Receiver }),
					cmpopts.IgnoreUnexported(ualert.Route{}, labels.Matcher{}),
				}
				if !cmp.Equal(tt.expected[orgId].AlertmanagerConfig.Route, amConfig.AlertmanagerConfig.Route, cOpt...) {
					t.Errorf("Unexpected Route: %v", cmp.Diff(tt.expected[orgId].AlertmanagerConfig.Route, amConfig.AlertmanagerConfig.Route, cOpt...))
				}
			}
		})
	}
}

// setupTestDB prepares the sqlite database and runs OSS migrations to initialize the schemas.
func setupTestDB(t *testing.T) *xorm.Engine {
	t.Helper()
	testDB := sqlutil.SQLite3TestDB()

	x, err := xorm.NewEngine(testDB.DriverName, testDB.ConnStr)
	require.NoError(t, err)

	err = migrator.NewDialect(x).CleanDB()
	require.NoError(t, err)

	mg := migrator.NewMigrator(x, &setting.Cfg{})
	migrations := &migrations.OSSMigrations{}
	migrations.AddMigration(mg)

	err = mg.Start(false, 0)
	require.NoError(t, err)

	return x
}

var (
	now = time.Now()
)

// createAlertNotification creates a legacy alert notification channel for inserting into the test database.
func createAlertNotification(t *testing.T, orgId int64, uid string, channelType string, settings string, defaultChannel bool) *models.AlertNotification {
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
		OrgId:                 orgId,
		Uid:                   uid,
		Name:                  uid, // Same as uid to make testing easier.
		Type:                  channelType,
		DisableResolveMessage: false,
		IsDefault:             defaultChannel,
		Settings:              settingsJson,
		SecureSettings:        make(map[string][]byte),
		Created:               now,
		Updated:               now,
	}
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
		OrgId:        orgId,
		DashboardId:  dashboardId,
		PanelId:      panelsId,
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
func createDashboard(t *testing.T, id int64, orgId int64, uid string) *models.Dashboard {
	t.Helper()
	return &models.Dashboard{
		Id:      id,
		OrgId:   orgId,
		Uid:     uid,
		Created: now,
		Updated: now,
		Title:   uid, // Not tested, needed to satisfy contraint.
	}
}

// createDatasource creates a ddatasource for inserting into the test database.
func createDatasource(t *testing.T, id int64, orgId int64, uid string) *models.DataSource {
	t.Helper()
	return &models.DataSource{
		Id:      id,
		OrgId:   orgId,
		Uid:     uid,
		Created: now,
		Updated: now,
		Name:    uid, // Not tested, needed to satisfy contraint.
	}
}

// teardown cleans the input tables between test cases.
func teardown(t *testing.T, x *xorm.Engine) {
	_, err := x.Exec("DELETE from alert")
	require.NoError(t, err)
	_, err = x.Exec("DELETE from alert_notification")
	require.NoError(t, err)
	_, err = x.Exec("DELETE from dashboard")
	require.NoError(t, err)
	_, err = x.Exec("DELETE from data_source")
	require.NoError(t, err)
}

// setupLegacyAlertsTables inserts data into the legacy alerting tables that is needed for testing the migration.
func setupLegacyAlertsTables(t *testing.T, x *xorm.Engine, legacyChannels []*models.AlertNotification, alerts []*models.Alert) {
	t.Helper()

	// Setup dashboards.
	dashboards := []models.Dashboard{
		*createDashboard(t, 1, 1, "dash1-1"),
		*createDashboard(t, 2, 1, "dash2-1"),
		*createDashboard(t, 3, 2, "dash3-2"),
		*createDashboard(t, 4, 2, "dash4-2"),
	}
	_, errDashboards := x.Insert(dashboards)
	require.NoError(t, errDashboards)

	// Setup data_sources.
	dataSources := []models.DataSource{
		*createDatasource(t, 1, 1, "ds1-1"),
		*createDatasource(t, 2, 1, "ds2-1"),
		*createDatasource(t, 3, 2, "ds3-2"),
		*createDatasource(t, 4, 2, "ds4-2"),
	}
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

// getAlertNameToUidMap fetches alert_rules from database to create map of alert.Name -> alert.Uid. This is needed as alert Uid is created during migration and is used to match routes to alerts.
func getAlertNameToUidMap(t *testing.T, x *xorm.Engine, orgId int64) map[string]string {
	t.Helper()
	alerts := []struct {
		Title string
		Uid   string
	}{}
	err := x.Table("alert_rule").Where("org_id = ?", orgId).Find(&alerts)
	require.NoError(t, err)

	res := make(map[string]string)
	for _, alert := range alerts {
		res[alert.Title] = alert.Uid
	}
	return res
}

// replaceAlertNameMatcherWithRuleUid replaces the stub matchers based on alert_name with the rule_uid's generated during migration.
func replaceAlertNameMatcherWithRuleUid(t *testing.T, rts []*ualert.Route, alertUids map[string]string) {
	for _, rt := range rts {
		if len(rt.Matchers) > 0 {
			// Replace alert name matcher with generated rule_uid matcher
			for _, m := range rt.Matchers {
				if m.Name == "alert_name" {
					m.Name = "rule_uid"
					m.Value = alertUids[m.Value]
				}
			}
		}

		// Recurse for nested routes.
		replaceAlertNameMatcherWithRuleUid(t, rt.Routes, alertUids)
	}
}

func boolPointer(b bool) *bool {
	return &b
}

// newMatchers creates a new ualert.Matchers given MatchType, name, and value.
func newMatchers(t labels.MatchType, n, v string) ualert.Matchers {
	matcher, _ := labels.NewMatcher(t, n, v)
	return ualert.Matchers(labels.Matchers{matcher})
}

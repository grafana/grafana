package migration

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/infra/db"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
)

// TestServiceRevert tests migration revert.
func TestServiceRevert(t *testing.T) {
	alerts := []*legacymodels.Alert{
		createAlert(t, 1, 1, 1, "alert1", []string{"notifier1"}),
	}
	channels := []*legacymodels.AlertNotification{
		createAlertNotification(t, int64(1), "notifier1", "email", emailSettings, false),
	}
	dashes := []*dashboards.Dashboard{
		createDashboard(t, 1, 1, "dash1-1", "folder5-1", 5, nil),
		createDashboard(t, 2, 1, "dash2-1", "folder5-1", 5, nil),
		createDashboard(t, 8, 1, "dash-in-general-1", "", 0, nil),
	}
	folders := []*dashboards.Dashboard{
		createFolder(t, 5, 1, "folder5-1"),
	}

	t.Run("revert deletes UA resources", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		x := sqlStore.GetEngine()

		setupLegacyAlertsTables(t, x, channels, alerts, folders, dashes)

		dashCount, err := x.Table("dashboard").Count(&dashboards.Dashboard{})
		require.NoError(t, err)
		require.Equal(t, int64(4), dashCount)

		// Run migration.
		ctx := context.Background()
		cfg := &setting.Cfg{
			UnifiedAlerting: setting.UnifiedAlertingSettings{
				Enabled: pointer(true),
			},
		}
		service := NewTestMigrationService(t, sqlStore, cfg)

		err = service.migrationStore.SetCurrentAlertingType(ctx, migrationStore.Legacy)
		require.NoError(t, err)

		require.NoError(t, service.Run(ctx))

		// Verify migration was run.
		checkAlertingType(t, ctx, service, migrationStore.UnifiedAlerting)
		checkMigrationStatus(t, ctx, service, 1, true)

		// Currently, we fill in some random data for tables that aren't populated during migration.
		_, err = x.Table("ngalert_configuration").Insert(models.AdminConfiguration{OrgID: 1})
		require.NoError(t, err)
		_, err = x.Table("alert_instance").Insert(models.AlertInstance{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleOrgID:  1,
				RuleUID:    "alert1",
				LabelsHash: "",
			},
			CurrentState:      models.InstanceStateNormal,
			CurrentStateSince: time.Now(),
			CurrentStateEnd:   time.Now(),
			LastEvalTime:      time.Now(),
		})
		require.NoError(t, err)

		// Verify various UA resources exist
		tables := [][2]string{
			{"alert_rule", "org_id"},
			{"alert_rule_version", "rule_org_id"},
			{"alert_configuration", "org_id"},
			{"ngalert_configuration", "org_id"},
			{"alert_instance", "rule_org_id"},
		}
		for _, table := range tables {
			count, err := x.Table(table[0]).Where(fmt.Sprintf("%s=?", table[1]), 1).Count()
			require.NoErrorf(t, err, "table %s error", table[0])
			require.True(t, count > 0, "table %s should have at least one row", table[0])
		}

		// Revert migration.
		err = service.migrationStore.RevertAllOrgs(context.Background())
		require.NoError(t, err)

		// Verify revert was run.
		checkAlertingType(t, ctx, service, migrationStore.Legacy)
		checkMigrationStatus(t, ctx, service, 1, false)

		// Verify various UA resources are gone
		for _, table := range tables {
			count, err := x.Table(table[0]).Where(fmt.Sprintf("%s=?", table[1]), 1).Count()
			require.NoErrorf(t, err, "table %s error", table[0])
			require.Equal(t, int64(0), count, "table %s should have no rows", table[0])
		}
	})

	t.Run("revert deletes folders created during migration", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		x := sqlStore.GetEngine()
		alerts = []*legacymodels.Alert{
			createAlert(t, 1, 8, 1, "alert1", []string{"notifier1"}),
		}
		setupLegacyAlertsTables(t, x, channels, alerts, folders, dashes)

		dashCount, err := x.Table("dashboard").Count(&dashboards.Dashboard{})
		require.NoError(t, err)
		require.Equal(t, int64(4), dashCount)

		// Run migration.
		ctx := context.Background()
		cfg := &setting.Cfg{
			UnifiedAlerting: setting.UnifiedAlertingSettings{
				Enabled: pointer(true),
			},
		}
		service := NewTestMigrationService(t, sqlStore, cfg)

		err = service.migrationStore.SetCurrentAlertingType(ctx, migrationStore.Legacy)
		require.NoError(t, err)

		require.NoError(t, service.Run(ctx))

		// Verify migration was run.
		checkAlertingType(t, ctx, service, migrationStore.UnifiedAlerting)
		checkMigrationStatus(t, ctx, service, 1, true)

		// Verify we created some folders.
		newDashCount, err := x.Table("dashboard").Count(&dashboards.Dashboard{})
		require.NoError(t, err)
		require.Truef(t, newDashCount > dashCount, "newDashCount: %d should be greater than dashCount: %d", newDashCount, dashCount)

		// Check that dashboards and folders from before migration still exist.
		require.NotNil(t, getDashboard(t, x, 1, "dash1-1"))
		require.NotNil(t, getDashboard(t, x, 1, "dash2-1"))
		require.NotNil(t, getDashboard(t, x, 1, "dash-in-general-1"))

		state, err := service.migrationStore.GetOrgMigrationState(ctx, 1)
		require.NoError(t, err)

		// Verify list of created folders.
		require.NotEmpty(t, state.CreatedFolders)
		for _, uid := range state.CreatedFolders {
			require.NotNil(t, getDashboard(t, x, 1, uid))
		}

		// Revert migration.
		err = service.migrationStore.RevertAllOrgs(context.Background())
		require.NoError(t, err)

		// Verify revert was run. Should only set migration status for org.
		checkAlertingType(t, ctx, service, migrationStore.Legacy)
		checkMigrationStatus(t, ctx, service, 1, false)

		// Verify we are back to the original count.
		newDashCount, err = x.Table("dashboard").Count(&dashboards.Dashboard{})
		require.NoError(t, err)
		require.Equalf(t, dashCount, newDashCount, "newDashCount: %d should be equal to dashCount: %d after revert", newDashCount, dashCount)

		// Check that dashboards and folders from before migration still exist.
		require.NotNil(t, getDashboard(t, x, 1, "dash1-1"))
		require.NotNil(t, getDashboard(t, x, 1, "dash2-1"))
		require.NotNil(t, getDashboard(t, x, 1, "dash-in-general-1"))

		// Check that folders created during migration are gone.
		for _, uid := range state.CreatedFolders {
			require.Nil(t, getDashboard(t, x, 1, uid))
		}
	})

	t.Run("revert skips migrated folders that are not empty", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		x := sqlStore.GetEngine()
		alerts = []*legacymodels.Alert{
			createAlert(t, 1, 8, 1, "alert1", []string{"notifier1"}),
		}
		setupLegacyAlertsTables(t, x, channels, alerts, folders, dashes)

		dashCount, err := x.Table("dashboard").Count(&dashboards.Dashboard{})
		require.NoError(t, err)
		require.Equal(t, int64(4), dashCount)

		// Run migration.
		ctx := context.Background()
		cfg := &setting.Cfg{
			UnifiedAlerting: setting.UnifiedAlertingSettings{
				Enabled: pointer(true),
				Upgrade: setting.UnifiedAlertingUpgradeSettings{},
			},
		}
		service := NewTestMigrationService(t, sqlStore, cfg)

		err = service.migrationStore.SetCurrentAlertingType(ctx, migrationStore.Legacy)
		require.NoError(t, err)

		require.NoError(t, service.Run(ctx))

		// Verify migration was run.
		checkAlertingType(t, ctx, service, migrationStore.UnifiedAlerting)
		checkMigrationStatus(t, ctx, service, 1, true)

		// Verify we created some folders.
		newDashCount, err := x.Table("dashboard").Count(&dashboards.Dashboard{OrgID: 1})
		require.NoError(t, err)
		require.Truef(t, newDashCount > dashCount, "newDashCount: %d should be greater than dashCount: %d", newDashCount, dashCount)

		// Check that dashboards and folders from before migration still exist.
		require.NotNil(t, getDashboard(t, x, 1, "dash1-1"))
		require.NotNil(t, getDashboard(t, x, 1, "dash2-1"))
		require.NotNil(t, getDashboard(t, x, 1, "dash-in-general-1"))

		state, err := service.migrationStore.GetOrgMigrationState(ctx, 1)
		require.NoError(t, err)

		// Verify list of created folders.
		require.NotEmpty(t, state.CreatedFolders)
		var generalAlertingFolder *dashboards.Dashboard
		for _, uid := range state.CreatedFolders {
			f := getDashboard(t, x, 1, uid)
			require.NotNil(t, f)
			if f.Slug == "general-alerting" {
				generalAlertingFolder = f
			}
		}
		require.NotNil(t, generalAlertingFolder)

		// Create dashboard in general alerting.
		newDashes := []*dashboards.Dashboard{
			createDashboard(t, 99, 1, "dash-in-general-alerting-1", generalAlertingFolder.UID, generalAlertingFolder.ID, nil),
		}
		_, err = x.Insert(newDashes)
		require.NoError(t, err)

		newF := getDashboard(t, x, 1, "dash-in-general-alerting-1")
		require.NotNil(t, newF)

		// Revert migration.
		err = service.migrationStore.RevertAllOrgs(context.Background())
		require.NoError(t, err)

		// Verify revert was run. Should only set migration status for org.
		checkAlertingType(t, ctx, service, migrationStore.Legacy)
		checkMigrationStatus(t, ctx, service, 1, false)

		// Verify we are back to the original count + 2.
		newDashCount, err = x.Table("dashboard").Count(&dashboards.Dashboard{OrgID: 1})
		require.NoError(t, err)
		require.Equalf(t, dashCount+2, newDashCount, "newDashCount: %d should be equal to dashCount + 2: %d after revert", newDashCount, dashCount)

		// Check that dashboards and folders from before migration still exist.
		require.NotNil(t, getDashboard(t, x, 1, "dash1-1"))
		require.NotNil(t, getDashboard(t, x, 1, "dash2-1"))
		require.NotNil(t, getDashboard(t, x, 1, "dash-in-general-1"))

		// Check that the general alerting folder still exists.
		require.NotNil(t, getDashboard(t, x, 1, generalAlertingFolder.UID))
		// Check that the new dashboard in general alerting folder still exists.
		require.NotNil(t, getDashboard(t, x, 1, "dash-in-general-alerting-1"))

		// Check that other folders created during migration are gone.
		for _, uid := range state.CreatedFolders {
			if uid == generalAlertingFolder.UID {
				continue
			}
			require.Nil(t, getDashboard(t, x, 1, uid))
		}
	})

	t.Run("CleanUpgrade story", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		x := sqlStore.GetEngine()

		setupLegacyAlertsTables(t, x, channels, alerts, folders, dashes)

		ctx := context.Background()
		cfg := &setting.Cfg{
			UnifiedAlerting: setting.UnifiedAlertingSettings{
				Enabled: pointer(true),
			},
		}
		service := NewTestMigrationService(t, sqlStore, cfg)
		checkAlertingType(t, ctx, service, migrationStore.Legacy)
		checkMigrationStatus(t, ctx, service, 1, false)
		checkAlertRulesCount(t, x, 1, 0)

		// Enable UA.
		// First run should migrate org.
		require.NoError(t, service.Run(ctx))
		checkAlertingType(t, ctx, service, migrationStore.UnifiedAlerting)
		checkMigrationStatus(t, ctx, service, 1, true)
		checkAlertRulesCount(t, x, 1, 1)

		// Disable UA.
		// This run should just set migration status to false.
		service.cfg.UnifiedAlerting.Enabled = pointer(false)
		require.NoError(t, service.Run(ctx))
		checkAlertingType(t, ctx, service, migrationStore.Legacy)
		checkMigrationStatus(t, ctx, service, 1, true)
		checkAlertRulesCount(t, x, 1, 1)

		// Add another alert.
		// Enable UA without clean flag.
		// This run should not remigrate org, new alert is not migrated.
		_, alertErr := x.Insert(createAlert(t, 1, 1, 2, "alert2", []string{"notifier1"}))
		require.NoError(t, alertErr)
		service.cfg.UnifiedAlerting.Enabled = pointer(true)
		require.NoError(t, service.Run(ctx))
		checkAlertingType(t, ctx, service, migrationStore.UnifiedAlerting)
		checkMigrationStatus(t, ctx, service, 1, true)
		checkAlertRulesCount(t, x, 1, 1) // Still 1

		// Disable UA with clean flag.
		// This run should not revert UA data.
		service.cfg.UnifiedAlerting.Enabled = pointer(false)
		service.cfg.UnifiedAlerting.Upgrade.CleanUpgrade = true
		require.NoError(t, service.Run(ctx))
		checkAlertingType(t, ctx, service, migrationStore.Legacy)
		checkMigrationStatus(t, ctx, service, 1, true)
		checkAlertRulesCount(t, x, 1, 1) // Still 1

		// Enable UA with clean flag.
		// This run should revert and remigrate org, new alert is migrated.
		service.cfg.UnifiedAlerting.Enabled = pointer(true)
		require.NoError(t, service.Run(ctx))
		checkAlertingType(t, ctx, service, migrationStore.UnifiedAlerting)
		checkMigrationStatus(t, ctx, service, 1, true)
		checkAlertRulesCount(t, x, 1, 2) // Now we have 2

		// The following tests ForceMigration which is deprecated and will be removed in v11.
		service.cfg.UnifiedAlerting.Upgrade.CleanUpgrade = false

		// Disable UA with force flag.
		// This run should not revert UA data.
		service.cfg.UnifiedAlerting.Enabled = pointer(false)
		service.cfg.ForceMigration = true
		require.NoError(t, service.Run(ctx))
		checkAlertingType(t, ctx, service, migrationStore.Legacy)
		checkMigrationStatus(t, ctx, service, 1, false)
		checkAlertRulesCount(t, x, 1, 0)
	})
}

func checkMigrationStatus(t *testing.T, ctx context.Context, service *migrationService, orgID int64, expected bool) {
	migrated, err := service.migrationStore.IsMigrated(ctx, orgID)
	require.NoError(t, err)
	require.Equal(t, expected, migrated)
}

func checkAlertingType(t *testing.T, ctx context.Context, service *migrationService, expected migrationStore.AlertingType) {
	aType, err := service.migrationStore.GetCurrentAlertingType(ctx)
	require.NoError(t, err)
	require.Equal(t, expected, aType)
}

func checkAlertRulesCount(t *testing.T, x *xorm.Engine, orgID int64, count int) {
	cnt, err := x.Table("alert_rule").Where("org_id=?", orgID).Count()
	require.NoError(t, err, "table alert_rule error")
	require.Equal(t, int(cnt), count, "table alert_rule should have no rows")
}

type testcase struct {
	name         string
	orgToMigrate int64
	skipExisting bool

	// Common Inputs
	folders        []*dashboards.Dashboard
	dashboards     []*dashboards.Dashboard
	dashboardPerms map[string][]accesscontrol.SetResourcePermissionCommand

	initialLegacyState legacyState
	initialUAState     *uaState

	operations []testOp
}
type legacyState struct {
	alerts   []*legacymodels.Alert
	channels []*legacymodels.AlertNotification
}
type uaState struct {
	alerts       []*models.AlertRule
	amConfig     *definitions.PostableUserConfig
	migState     *migrationStore.OrgMigrationState
	serviceState *definitions.OrgMigrationState // output only.
}

type testOp struct {
	description       string
	newLegacyState    *legacyState
	updateLegacyState *legacyState
	operation         func(ctx context.Context, tt testcase, service *migrationService, x *xorm.Engine) error
	expectedUAState   *uaState
	expectedErrors    []string
}

//nolint:gocyclo
func TestCommonServicePatterns(t *testing.T) {
	sh := newServiceHelper(t)
	f1 := sh.genFolder()
	f2 := sh.genFolder()
	generalAlertingFolder := sh.genFolder()
	generalAlertingFolder.UID = "general-alerting"
	generalAlertingFolder.Title = "General Alerting"
	sh.folders[generalAlertingFolder.ID] = generalAlertingFolder
	sh.foldersByUID[generalAlertingFolder.UID] = generalAlertingFolder

	generalFolder := &dashboards.Dashboard{
		ID:    0,
		Title: "General",
	}
	sh.folders[generalFolder.ID] = generalFolder
	sh.foldersByUID[generalFolder.UID] = generalFolder

	d1 := sh.genDash(f1)
	alerts1 := sh.genAlerts(d1, 10)
	rules1, pairs1 := sh.genAlertPairs(f1, d1, alerts1)

	d2 := sh.genDash(f1)
	alerts2 := sh.genAlerts(d2, 10)
	rules2, pairs2 := sh.genAlertPairs(f1, d2, alerts2)

	d3 := sh.genDash(f2)
	alerts3 := sh.genAlerts(d3, 10)
	_, pairs3 := sh.genAlertPairs(f2, d3, alerts3)

	channels1 := sh.genChannels(10)
	channels2 := sh.genChannels(10)

	modifiedAlerts := func(alerts []*legacymodels.Alert, muts ...func(alert *legacymodels.Alert)) []*legacymodels.Alert {
		newAlerts := copyAlerts(alerts...)
		for _, alert := range newAlerts {
			for _, mut := range muts {
				mut(alert)
			}
		}
		return newAlerts
	}

	modifiedSuffix := "-modified"

	withModifiedName := func(alert *legacymodels.Alert) {
		alert.Name = alert.Name + modifiedSuffix
	}

	withName := func(name string) func(alert *legacymodels.Alert) {
		return func(alert *legacymodels.Alert) {
			alert.Name = name
		}
	}

	withNotifiers := func(alert *legacymodels.Alert) {
		alert.Settings.Set("notifications", []notificationKey{{ID: alert.ID}})
	}

	modifiedPairs := func(pairs []*migmodels.AlertPair, muts ...func(alert *migmodels.AlertPair)) []*migmodels.AlertPair {
		newPairs := copyPairs(pairs...)
		for _, pair := range newPairs {
			for _, mut := range muts {
				mut(pair)
			}
		}
		return newPairs
	}

	withModifiedTitle := func(pair *migmodels.AlertPair) {
		pair.Rule.Title = pair.Rule.Title + modifiedSuffix
	}

	withTitle := func(name string) func(pair *migmodels.AlertPair) {
		return func(pair *migmodels.AlertPair) {
			pair.Rule.Title = name
			pair.LegacyRule.Name = name
		}
	}

	withNotifierLabels := func(pair *migmodels.AlertPair) {
		withNotifiers(pair.LegacyRule)
		pair.Rule.Labels[contactLabel(fmt.Sprintf("notifiername%d", pair.LegacyRule.ID))] = "true"
	}

	modifiedRules := func(alerts []*models.AlertRule, muts ...func(alert *models.AlertRule)) []*models.AlertRule {
		newAlerts := copyRules(alerts...)
		for _, alert := range newAlerts {
			for _, mut := range muts {
				mut(alert)
			}
		}
		return newAlerts
	}

	withFolder := func(f *dashboards.Dashboard) func(alert *models.AlertRule) {
		return func(alert *models.AlertRule) {
			alert.NamespaceUID = f.UID
		}
	}

	modifiedChannels := func(channels []*legacymodels.AlertNotification, muts ...func(c *legacymodels.AlertNotification)) []*legacymodels.AlertNotification {
		newChannels := copyChannels(channels...)
		for _, c := range newChannels {
			for _, mut := range muts {
				mut(c)
			}
		}
		return newChannels
	}

	withModifiedChannelName := func(c *legacymodels.AlertNotification) {
		c.Name = c.Name + modifiedSuffix
	}

	withType := func(t string) func(c *legacymodels.AlertNotification) {
		return func(c *legacymodels.AlertNotification) {
			c.Type = t
		}
	}

	modifiedState := func(state *uaState, muts ...func(state *uaState)) *uaState {
		for _, mut := range muts {
			mut(state)
		}
		return state
	}

	for _, tt := range []testcase{
		{
			name:         "Standard org migration",
			orgToMigrate: 1,
			folders:      []*dashboards.Dashboard{f1, f2},
			dashboards:   []*dashboards.Dashboard{d1},

			initialLegacyState: legacyState{
				alerts:   alerts1,
				channels: channels1,
			},
			operations: []testOp{
				{
					description:     "initial migration",
					operation:       migrateOrgOp,
					expectedUAState: sh.uaState(t, channels1, pairs1),
				},
			},
		},
		{
			name:         "Standard org migration with multiple dashboards",
			orgToMigrate: 1,
			folders:      []*dashboards.Dashboard{f1, f2},
			dashboards:   []*dashboards.Dashboard{d1, d2, d3},

			initialLegacyState: legacyState{
				alerts: append(append(alerts1, alerts2...), alerts3...),
			},
			operations: []testOp{
				{
					description:     "initial migration",
					operation:       migrateOrgOp,
					expectedUAState: sh.uaState(t, nil, pairs1, pairs2, pairs3),
				},
			},
		},
		{
			name:         "with existing alerts & channels not from migration, doesn't delete existing",
			orgToMigrate: 1,
			folders:      []*dashboards.Dashboard{f1, f2},
			dashboards:   []*dashboards.Dashboard{d1},

			initialLegacyState: legacyState{
				alerts:   alerts1,
				channels: channels1,
			},
			initialUAState: &uaState{ // Not connected to the migration.
				alerts:   rules2,
				amConfig: createPostableUserConfig(t, channels2...),
			},
			operations: []testOp{
				{
					description: "initial migration",
					operation:   migrateOrgOp,
					expectedUAState: modifiedState(sh.uaState(t, channels1, pairs1), func(state *uaState) {
						state.alerts = append(state.alerts, rules2...)
						state.amConfig = createPostableUserConfig(t, append(channels1, channels2...)...)
					}),
				},
				{
					description: "all dashboards migration, no change",
					operation:   migrateAllDashboardAlertsOp(false),
					expectedUAState: modifiedState(sh.uaState(t, channels1, pairs1), func(state *uaState) {
						state.alerts = append(state.alerts, rules2...)
						state.amConfig = createPostableUserConfig(t, append(channels1, channels2...)...)
					}),
				},
				{
					description: "all channels migration, no change",
					operation:   migrateAllChannelsOp(false),
					expectedUAState: modifiedState(sh.uaState(t, channels1, pairs1), func(state *uaState) {
						state.alerts = append(state.alerts, rules2...)
						state.amConfig = createPostableUserConfig(t, append(channels1, channels2...)...)
					}),
				},
				{
					description: "dashboard d1 migration, no change",
					operation:   migrateDashboardAlertsOp(false, d1.ID),
					expectedUAState: modifiedState(sh.uaState(t, channels1, pairs1), func(state *uaState) {
						state.alerts = append(state.alerts, rules2...)
						state.amConfig = createPostableUserConfig(t, append(channels1, channels2...)...)
					}),
				},
				{
					description: "channels[0] migration, no change",
					operation:   migrateChannelOp(d1.ID, channels1[0].ID),
					expectedUAState: modifiedState(sh.uaState(t, channels1, pairs1), func(state *uaState) {
						state.alerts = append(state.alerts, rules2...)
						state.amConfig = createPostableUserConfig(t, append(channels1, channels2...)...)
					}),
				},
				{
					description: "alerts d1[0] migration, no change",
					operation:   migrateAlertOp(d1.ID, alerts1[0].PanelID),
					expectedUAState: modifiedState(sh.uaState(t, channels1, pairs1), func(state *uaState) {
						state.alerts = append(state.alerts, rules2...)
						state.amConfig = createPostableUserConfig(t, append(channels1, channels2...)...)
					}),
				},
			},
		},
		{
			name:         "migrateAlert with existing alerts in different folder",
			orgToMigrate: 1,
			folders:      []*dashboards.Dashboard{f1, f2},
			dashboards:   []*dashboards.Dashboard{d1},
			initialLegacyState: legacyState{
				alerts: alerts1[:5:5],
			},
			operations: []testOp{
				{
					description:     "initial migration",
					operation:       migrateOrgOp,
					expectedUAState: sh.uaState(t, nil, pairs1[:5:5]),
				},
				{
					description: "move dashboard d1 to folder f2",
					operation: func(ctx context.Context, tt testcase, service *migrationService, x *xorm.Engine) error {
						d1Copy := *d1
						//nolint:staticcheck
						d1Copy.FolderID = f2.ID
						_, err := x.ID(d1.ID).Update(d1Copy)
						return err
					},
				},
				{
					description: "add more alerts to d1 and migrate them",
					newLegacyState: &legacyState{
						alerts: alerts1[5:6:6],
					},
					operation: migrateAlertOp(d1.ID, alerts1[5].PanelID),
					expectedUAState: modifiedState(sh.uaState(t, nil, pairs1[:6:6]), func(state *uaState) {
						state.serviceState.MigratedDashboards[0].FolderUID = f2.UID
						state.serviceState.MigratedDashboards[0].FolderName = f2.Title
					}),
				},
				{
					description: "add more alerts to d1 and migrate them using migrate dashboard skipExisting=true",
					newLegacyState: &legacyState{
						alerts: alerts1[6:10:10],
					},
					operation: migrateDashboardAlertsOp(true, d1.ID),
					expectedUAState: modifiedState(sh.uaState(t, nil, pairs1), func(state *uaState) {
						state.serviceState.MigratedDashboards[0].FolderUID = f2.UID
						state.serviceState.MigratedDashboards[0].FolderName = f2.Title
					}),
				},
				{
					description: "migrate with skipExisting=false should move all the alerts to f2",
					operation:   migrateDashboardAlertsOp(false, d1.ID),
					expectedUAState: modifiedState(sh.uaState(t, nil, modifiedPairs(pairs1, func(p *migmodels.AlertPair) { p.Rule.NamespaceUID = f2.UID })), func(state *uaState) {
						state.serviceState.MigratedDashboards[0].FolderUID = f2.UID
						state.serviceState.MigratedDashboards[0].FolderName = f2.Title
					}),
				},
			},
		},
		{
			name:         "migrate alerts using various skipExisting",
			orgToMigrate: 1,
			folders:      []*dashboards.Dashboard{f1, f2},
			dashboards:   []*dashboards.Dashboard{d1, d2, d3},

			initialLegacyState: legacyState{
				alerts: alerts1,
			},
			operations: []testOp{
				{
					description:     "initial migration",
					operation:       migrateOrgOp,
					expectedUAState: sh.uaState(t, nil, pairs1),
				},
				{
					description: "add some alerts for d2 & d3 and migrate dashboard d2",
					newLegacyState: &legacyState{
						alerts: append(alerts2[:5:5], alerts3[:5:5]...),
					},
					operation: migrateDashboardAlertsOp(false, d2.ID),
					expectedUAState: modifiedState(sh.uaState(t, nil, pairs1, pairs2[:5:5]), func(state *uaState) {
						state.serviceState.MigratedDashboards = append(state.serviceState.MigratedDashboards, &definitions.DashboardUpgrade{
							DashboardID:    d3.ID,
							DashboardUID:   d3.UID,
							DashboardName:  d3.Title,
							FolderUID:      f2.UID,
							FolderName:     f2.Title,
							MigratedAlerts: make([]*definitions.AlertPair, 5),
							Error:          "dashboard not upgraded",
						})
						for i, a := range alerts3[:5:5] {
							state.serviceState.MigratedDashboards[2].MigratedAlerts[i] = &definitions.AlertPair{
								LegacyAlert: fromLegacyAlert(a),
								Error:       "alert not upgraded",
							}
						}
					}),
				},
				{
					description: "modify the alerts already migrated for d2 and add the rest, migrate dashboard d2 with skipExisting",
					updateLegacyState: &legacyState{
						alerts: modifiedAlerts(alerts2[:5:5], withModifiedName),
					},
					newLegacyState: &legacyState{
						alerts: alerts2[5:],
					},
					operation: migrateDashboardAlertsOp(true, d2.ID),
					expectedUAState: modifiedState(sh.uaState(t, nil, pairs1, pairs2), func(state *uaState) {
						for i := 0; i < 5; i++ {
							state.serviceState.MigratedDashboards[1].MigratedAlerts[i].LegacyAlert.Name += modifiedSuffix
						}
						state.serviceState.MigratedDashboards = append(state.serviceState.MigratedDashboards, &definitions.DashboardUpgrade{
							DashboardID:    d3.ID,
							DashboardUID:   d3.UID,
							DashboardName:  d3.Title,
							FolderUID:      f2.UID,
							FolderName:     f2.Title,
							MigratedAlerts: make([]*definitions.AlertPair, 5),
							Error:          "dashboard not upgraded",
						})
						for i, a := range alerts3[:5:5] {
							state.serviceState.MigratedDashboards[2].MigratedAlerts[i] = &definitions.AlertPair{
								LegacyAlert: fromLegacyAlert(a),
								Error:       "alert not upgraded",
							}
						}
					}), // Because of skipExisting, expected doesn't contain the modifications.
				},
				{
					description: "migrate dashboard d3 using migrate all dashboards",
					operation:   migrateAllDashboardAlertsOp(true),
					expectedUAState: modifiedState(sh.uaState(t, nil, pairs1, pairs2, pairs3[:5:5]), func(state *uaState) {
						for i := 0; i < 5; i++ {
							state.serviceState.MigratedDashboards[1].MigratedAlerts[i].LegacyAlert.Name += modifiedSuffix
						}
					}),
				},
				{
					description: "migrate dashboard d2 with skipExisting=false should update using the modifications",
					operation:   migrateDashboardAlertsOp(false, d2.ID),
					expectedUAState: modifiedState(sh.uaState(t, nil, pairs1, append(modifiedPairs(pairs2[:5:5], withModifiedTitle), pairs2[5:]...), pairs3[:5:5]), func(state *uaState) {
						for i := 0; i < 5; i++ {
							state.serviceState.MigratedDashboards[1].MigratedAlerts[i].LegacyAlert.Name += modifiedSuffix
						}
					}),
				},
				{
					description: "modify existing d3 alerts and add the rest, migrate one new alert on dashboard d3, should not update modifications",
					updateLegacyState: &legacyState{
						alerts: modifiedAlerts(alerts3[:5:5], withModifiedName),
					},
					newLegacyState: &legacyState{
						alerts: alerts3[5:],
					},
					operation: migrateAlertOp(d3.ID, alerts3[5].PanelID),
					expectedUAState: modifiedState(sh.uaState(t, nil, pairs1, append(modifiedPairs(pairs2[:5:5], withModifiedTitle), pairs2[5:]...), pairs3[:6:6]), func(state *uaState) {
						for i := 0; i < 5; i++ {
							state.serviceState.MigratedDashboards[1].MigratedAlerts[i].LegacyAlert.Name += modifiedSuffix
							state.serviceState.MigratedDashboards[2].MigratedAlerts[i].LegacyAlert.Name += modifiedSuffix
						}
						for _, a := range alerts3[6:] {
							state.serviceState.MigratedDashboards[2].MigratedAlerts = append(state.serviceState.MigratedDashboards[2].MigratedAlerts, &definitions.AlertPair{
								LegacyAlert: fromLegacyAlert(a),
								Error:       "alert not upgraded",
							})
						}
					}),
				},
				{
					description: "migrate one existing alert on dashboard d3, should update modifications",
					operation:   migrateAlertOp(d3.ID, alerts3[0].PanelID),
					expectedUAState: modifiedState(sh.uaState(t, nil, pairs1, append(modifiedPairs(pairs2[:5:5], withModifiedTitle), pairs2[5:]...), append(modifiedPairs(pairs3[0:1:1], withModifiedTitle), pairs3[1:6:6]...)), func(state *uaState) {
						for i := 0; i < 5; i++ {
							state.serviceState.MigratedDashboards[1].MigratedAlerts[i].LegacyAlert.Name += modifiedSuffix
							state.serviceState.MigratedDashboards[2].MigratedAlerts[i].LegacyAlert.Name += modifiedSuffix
						}
						for _, a := range alerts3[6:] {
							state.serviceState.MigratedDashboards[2].MigratedAlerts = append(state.serviceState.MigratedDashboards[2].MigratedAlerts, &definitions.AlertPair{
								LegacyAlert: fromLegacyAlert(a),
								Error:       "alert not upgraded",
							})
						}
					}),
				},
				{
					description: "update d1 alerts, and re-migrate all dashboards",
					updateLegacyState: &legacyState{
						alerts: modifiedAlerts(alerts1, withModifiedName),
					},
					operation: migrateAllDashboardAlertsOp(false),
					expectedUAState: modifiedState(sh.uaState(t, nil, modifiedPairs(pairs1, withModifiedTitle), append(modifiedPairs(pairs2[:5:5], withModifiedTitle), pairs2[5:]...), append(modifiedPairs(pairs3[0:5:5], withModifiedTitle), pairs3[5:]...)), func(state *uaState) {
						for i := 0; i < 5; i++ {
							state.serviceState.MigratedDashboards[1].MigratedAlerts[i].LegacyAlert.Name += modifiedSuffix
							state.serviceState.MigratedDashboards[2].MigratedAlerts[i].LegacyAlert.Name += modifiedSuffix
						}
						for i := 0; i < 10; i++ {
							state.serviceState.MigratedDashboards[0].MigratedAlerts[i].LegacyAlert.Name += modifiedSuffix
						}
					}),
				},
			},
		},
		{
			name:               "MigrateAllChannels skip=true doesn't update existing channels",
			orgToMigrate:       1,
			initialLegacyState: legacyState{channels: channels1},
			initialUAState:     sh.uaState(t, channels1),
			operations: []testOp{
				{
					updateLegacyState: &legacyState{channels: modifiedChannels(channels1, withModifiedChannelName)},
					operation:         migrateAllChannelsOp(true),
					expectedUAState: modifiedState(sh.uaState(t, channels1), func(state *uaState) {
						for _, c := range state.serviceState.MigratedChannels {
							c.LegacyChannel.Name += modifiedSuffix
						}
					}),
				},
			},
		},
		{
			name:               "MigrateAllChannels skip=false updates existing channels",
			orgToMigrate:       1,
			initialLegacyState: legacyState{channels: channels1},
			initialUAState:     sh.uaState(t, channels1),
			operations: []testOp{
				{
					updateLegacyState: &legacyState{channels: modifiedChannels(channels1, withModifiedChannelName)},
					operation:         migrateAllChannelsOp(false),
					expectedUAState:   sh.uaState(t, modifiedChannels(channels1, withModifiedChannelName)),
				},
			},
		},
		{
			name:               "MigrateAllChannels skip=false doesn't delete existing channels unrelated to migration",
			orgToMigrate:       1,
			initialLegacyState: legacyState{channels: channels1},
			initialUAState: &uaState{
				amConfig: createPostableUserConfig(t, channels2...),
			},
			operations: []testOp{
				{
					operation: migrateAllChannelsOp(false),
					expectedUAState: modifiedState(sh.uaState(t, channels1), func(state *uaState) {
						state.amConfig = createPostableUserConfig(t, append(channels1, channels2...)...)
					}),
				},
			},
		},
		{
			name:               "MigrateAllChannels skip=true adds new channels",
			orgToMigrate:       1,
			initialLegacyState: legacyState{channels: channels1},
			initialUAState:     sh.uaState(t, channels1),
			operations: []testOp{
				{
					newLegacyState:  &legacyState{channels: channels2},
					operation:       migrateAllChannelsOp(true),
					expectedUAState: sh.uaState(t, append(channels1, channels2...)),
				},
			},
		},
		{
			name:               "MigrateAllChannels skip=false adds new channels",
			orgToMigrate:       1,
			initialLegacyState: legacyState{channels: channels1},
			initialUAState:     sh.uaState(t, channels1),
			operations: []testOp{
				{
					newLegacyState:  &legacyState{channels: channels2},
					operation:       migrateAllChannelsOp(false),
					expectedUAState: sh.uaState(t, append(channels1, channels2...)),
				},
			},
		},
		{
			name:               "MigrateSingleChannel adds new channel and doesn't affect others",
			orgToMigrate:       1,
			initialLegacyState: legacyState{channels: channels1},
			initialUAState:     sh.uaState(t, channels1),
			operations: []testOp{
				{
					newLegacyState:  &legacyState{channels: channels2[0:1:1]},
					operation:       migrateChannelOp(channels2[0].ID),
					expectedUAState: sh.uaState(t, append(channels1, channels2[0])),
				},
			},
		},
		{
			name:               "MigrateSingleChannel updates existing channel and doesn't affect others",
			orgToMigrate:       1,
			initialLegacyState: legacyState{channels: channels1},
			initialUAState:     sh.uaState(t, channels1),
			operations: []testOp{
				{
					updateLegacyState: &legacyState{channels: modifiedChannels(channels1, withModifiedChannelName)},
					operation:         migrateChannelOp(channels1[9].ID),
					expectedUAState: modifiedState(sh.uaState(t, append(channels1[0:9:9], modifiedChannels(channels1[9:], withModifiedChannelName)...)), func(state *uaState) {
						for i := 0; i < 10; i++ {
							state.serviceState.MigratedChannels[i].LegacyChannel.Name = channels1[i].Name + modifiedSuffix
						}
					}),
				},
			},
		},
		{
			name:               "MigrateSingleChannel removes deleted channel and doesn't affect others",
			orgToMigrate:       1,
			initialLegacyState: legacyState{channels: channels1[0:9:9]},
			initialUAState:     sh.uaState(t, channels1), // Existing state has channels1[9].
			operations: []testOp{
				{
					operation:       migrateChannelOp(channels1[9].ID),
					expectedUAState: sh.uaState(t, channels1[0:9:9]),
				},
			},
		},
		{
			name:               "MigrateSingleChannel doesn't delete existing channels unrelated to migration",
			orgToMigrate:       1,
			initialLegacyState: legacyState{channels: []*legacymodels.AlertNotification{channels1[0]}},
			initialUAState: &uaState{
				amConfig: createPostableUserConfig(t, channels2...),
			},
			operations: []testOp{
				{
					operation: migrateChannelOp(channels1[0].ID),
					expectedUAState: modifiedState(sh.uaState(t, channels1[0:1:1]), func(state *uaState) {
						state.amConfig = createPostableUserConfig(t, append(channels2, channels1[0])...)
					}),
				},
			},
		},
		{
			name:         "alert titles should be deduplicated",
			orgToMigrate: 1,
			folders:      []*dashboards.Dashboard{f1},
			dashboards:   []*dashboards.Dashboard{d1},

			initialLegacyState: legacyState{
				alerts: modifiedAlerts(alerts1, withName("duplicate name")),
			},
			operations: []testOp{
				{
					description: "initial migration",
					operation:   migrateOrgOp,
					expectedUAState: modifiedState(sh.uaState(t, nil, modifiedPairs(pairs1, withTitle("duplicate name"))), func(state *uaState) {
						state.alerts[0].Title = "duplicate name"
						for i := 1; i < len(state.alerts); i++ { // First pair doesn't need to be deduplicated.
							state.alerts[i].Title = fmt.Sprintf("duplicate name #%d", i+1)
						}
						for i := 0; i < len(state.alerts); i++ {
							state.serviceState.MigratedDashboards[0].MigratedAlerts[i].AlertRule.Title = state.alerts[i].Title
						}
					}),
				},
			},
		},
		{
			name:         "alert titles should be truncated",
			orgToMigrate: 1,
			folders:      []*dashboards.Dashboard{f1},
			dashboards:   []*dashboards.Dashboard{d1},

			initialLegacyState: legacyState{
				alerts: modifiedAlerts(alerts1[0:1:1], withName(strings.Repeat("a", store.AlertDefinitionMaxTitleLength+1))),
			},
			operations: []testOp{
				{
					operation: migrateOrgOp,
					expectedUAState: modifiedState(sh.uaState(t, nil, modifiedPairs(pairs1[0:1:1], withTitle(strings.Repeat("a", store.AlertDefinitionMaxTitleLength)))), func(state *uaState) {
						state.serviceState.MigratedDashboards[0].MigratedAlerts[0].LegacyAlert.Name = strings.Repeat("a", store.AlertDefinitionMaxTitleLength+1)
					})},
			},
		},
		{
			name:         "alert titles should be truncated and deduplicated",
			orgToMigrate: 1,
			folders:      []*dashboards.Dashboard{f1},
			dashboards:   []*dashboards.Dashboard{d1},

			initialLegacyState: legacyState{
				alerts: modifiedAlerts(alerts1, withName(strings.Repeat("a", store.AlertDefinitionMaxTitleLength+1))),
			},
			operations: []testOp{
				{
					operation: migrateOrgOp,
					expectedUAState: func() *uaState {
						pairs := modifiedPairs(pairs1, withTitle(strings.Repeat("a", store.AlertDefinitionMaxTitleLength)))
						for i := 1; i < len(pairs); i++ { // First pair doesn't need to be deduplicated.
							suffix := fmt.Sprintf(" #%d", i+1)
							pairs[i].Rule.Title = fmt.Sprintf("%s%s", pairs[i].Rule.Title[:store.AlertDefinitionMaxTitleLength-len(suffix)], suffix)
						}
						state := sh.uaState(t, nil, pairs)
						for i := 0; i < len(pairs); i++ {
							state.serviceState.MigratedDashboards[0].MigratedAlerts[i].LegacyAlert.Name = strings.Repeat("a", store.AlertDefinitionMaxTitleLength+1)
						}
						return state
					}(),
				},
			},
		},
		{
			name:         "alert has invalid settings, should return pair with error",
			orgToMigrate: 1,
			folders:      []*dashboards.Dashboard{f1, f2},
			dashboards:   []*dashboards.Dashboard{d1},

			initialLegacyState: legacyState{
				// Break the last half of the alerts.
				alerts: append(alerts1[:5:5], modifiedAlerts(alerts1[5:10:10], func(alert *legacymodels.Alert) { alert.Settings.Set("noDataState", 1.5) })...),
			},
			operations: []testOp{
				{
					operation: migrateOrgOp,
					expectedUAState: &uaState{
						alerts: rules1[:5:5],
						migState: &migrationStore.OrgMigrationState{
							OrgID: 1,
							MigratedDashboards: map[int64]*migrationStore.DashboardUpgrade{
								d1.ID: sh.dashUpgrade(d1.ID, f1.UID, append(pairs1[:5:5], modifiedPairs(pairs1[5:10:10], func(pair *migmodels.AlertPair) {
									pair.Error = errors.New("parse settings: json: cannot unmarshal number into Go struct field dashAlertSettings.noDataState of type string")
									pair.Rule.UID = ""
								})...), ""),
							},
						},
					},
				},
			},
		},
		{
			name:         "alert has missing dashboard, should return pair with error",
			orgToMigrate: 1,
			folders:      []*dashboards.Dashboard{f1, f2},
			dashboards:   []*dashboards.Dashboard{d1},

			initialLegacyState: legacyState{
				// Set dashboard to nonexisting id for the last half of the alerts.
				alerts: append(alerts1[:5:5], modifiedAlerts(alerts1[5:10:10], func(alert *legacymodels.Alert) { alert.DashboardID = -42 })...),
			},
			operations: []testOp{
				{
					operation: migrateOrgOp,
					expectedUAState: &uaState{
						alerts: rules1[:5:5],
						migState: &migrationStore.OrgMigrationState{
							OrgID: 1,
							MigratedDashboards: map[int64]*migrationStore.DashboardUpgrade{
								d1.ID: sh.dashUpgrade(d1.ID, f1.UID, pairs1[:5:5], ""),
								-42: sh.dashUpgrade(-42, "", modifiedPairs(pairs1[5:10:10], func(pair *migmodels.AlertPair) {
									pair.Error = errors.New("orphaned: missing dashboard")
									pair.Rule.UID = ""
								}), ""),
							},
						},
					},
				},
			},
		},
		{
			name:         "alert dashboard has missing folder, should migrate to new general alerting folder",
			orgToMigrate: 1,
			folders:      []*dashboards.Dashboard{f1, generalAlertingFolder},
			//nolint:staticcheck
			dashboards: []*dashboards.Dashboard{func(d dashboards.Dashboard) *dashboards.Dashboard { d.FolderID = 99999; return &d }(*d1), d2},

			initialLegacyState: legacyState{
				alerts: append(alerts1, alerts2...),
			},
			operations: []testOp{
				{
					operation: migrateOrgOp,
					expectedUAState: &uaState{
						alerts: append(modifiedRules(rules1, withFolder(generalAlertingFolder)), rules2...),
						migState: &migrationStore.OrgMigrationState{
							OrgID: 1,
							MigratedDashboards: map[int64]*migrationStore.DashboardUpgrade{
								d1.ID: sh.dashUpgrade(d1.ID, generalAlertingFolder.UID, pairs1, "dashboard alerts moved to general alerting folder during upgrade: original folder not found"),
								d2.ID: sh.dashUpgrade(d2.ID, f1.UID, pairs2, ""),
							},
						},
					},
				},
			},
		},
		{
			name:         "alert dashboard in general folder, should migrate to new general alerting folder",
			orgToMigrate: 1,
			folders:      []*dashboards.Dashboard{f1, generalAlertingFolder},
			//nolint:staticcheck
			dashboards: []*dashboards.Dashboard{func(d dashboards.Dashboard) *dashboards.Dashboard { d.FolderID = 0; return &d }(*d1), d2},

			initialLegacyState: legacyState{
				alerts: append(alerts1[0:1:1], alerts2[0]),
			},
			operations: []testOp{
				{
					description: "initial migration",
					operation:   migrateOrgOp,
					expectedUAState: &uaState{
						alerts: append(modifiedRules(rules1[0:1:1], withFolder(generalAlertingFolder)), rules2[0]),
						migState: &migrationStore.OrgMigrationState{
							OrgID: 1,
							MigratedDashboards: map[int64]*migrationStore.DashboardUpgrade{
								d1.ID: sh.dashUpgrade(d1.ID, generalAlertingFolder.UID, pairs1[0:1:1], "dashboard alerts moved to general alerting folder during upgrade: general folder not supported"),
								d2.ID: sh.dashUpgrade(d2.ID, f1.UID, pairs2[0:1:1], ""),
							},
						},
						serviceState: &definitions.OrgMigrationState{
							OrgID: 1,
							MigratedDashboards: []*definitions.DashboardUpgrade{
								{
									DashboardID:   d1.ID,
									DashboardUID:  d1.UID,
									DashboardName: d1.Title,
									FolderUID:     generalFolder.UID,
									FolderName:    generalFolder.Title,
									NewFolderUID:  generalAlertingFolder.UID,
									NewFolderName: generalAlertingFolder.Title,
									MigratedAlerts: []*definitions.AlertPair{
										{LegacyAlert: fromLegacyAlert(alerts1[0]), AlertRule: fromAlertRuleUpgrade(rules1[0], []string{"autogen-contact-point-default"})},
									},
									Warning: "dashboard alerts moved to general alerting folder during upgrade: general folder not supported",
								},
								{
									DashboardID:   d2.ID,
									DashboardUID:  d2.UID,
									DashboardName: d2.Title,
									FolderUID:     f1.UID,
									FolderName:    f1.Title,
									NewFolderUID:  f1.UID,
									NewFolderName: f1.Title,
									MigratedAlerts: []*definitions.AlertPair{
										{LegacyAlert: fromLegacyAlert(alerts2[0]), AlertRule: fromAlertRuleUpgrade(rules2[0], []string{"autogen-contact-point-default"})},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name:         "alert dashboard has custom permissions, should migrate to new folder",
			orgToMigrate: 1,
			folders: []*dashboards.Dashboard{
				f1,
				func() *dashboards.Dashboard {
					// The folder name is deterministic, so we can create the expected folder beforehand. This is so we know the uid for expected states.
					f := createFolder(t, 100, 1, "created-folder-id")
					f.Title = "folder1 Alerts - 787427ef800a01a544d6bae21970b4d2"
					return f
				}(),
			},
			dashboards: []*dashboards.Dashboard{d1, d2},
			dashboardPerms: map[string][]accesscontrol.SetResourcePermissionCommand{
				d2.UID: {{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_ADMIN.String()}}, // This permission maps to the 787427ef800a01a544d6bae21970b4d2 hash above.
			},
			initialLegacyState: legacyState{
				alerts: append(alerts1, alerts2...),
			},
			operations: []testOp{
				{
					operation: migrateOrgOp,
					expectedUAState: &uaState{
						alerts: append(rules1, modifiedRules(rules2, withFolder(&dashboards.Dashboard{UID: "created-folder-id"}))...),
						migState: &migrationStore.OrgMigrationState{
							OrgID: 1,
							MigratedDashboards: map[int64]*migrationStore.DashboardUpgrade{
								d1.ID: sh.dashUpgrade(d1.ID, f1.UID, pairs1, ""),
								d2.ID: sh.dashUpgrade(d2.ID, "created-folder-id", pairs2, "dashboard alerts moved to new folder during upgrade: folder permission changes were needed"),
							},
						},
					},
				},
			},
		},
		{
			name:               "channel is discontinued, should return pair with error",
			orgToMigrate:       1,
			initialLegacyState: legacyState{channels: channels1},
			operations: []testOp{
				{
					updateLegacyState: &legacyState{channels: modifiedChannels([]*legacymodels.AlertNotification{channels1[8], channels1[9]}, withType("hipchat"))},
					operation:         migrateAllChannelsOp(false),
					expectedUAState: &uaState{
						amConfig: createPostableUserConfig(t, channels1[:8:8]...),
						migState: &migrationStore.OrgMigrationState{
							OrgID: 1,
							MigratedChannels: func() map[int64]*migrationStore.ContactPair {
								pairs := sh.contactPairs(channels1...)
								pairs[channels1[8].ID].Error = "'hipchat': discontinued"
								pairs[channels1[8].ID].NewReceiverUID = ""
								pairs[channels1[9].ID].Error = "'hipchat': discontinued"
								pairs[channels1[9].ID].NewReceiverUID = ""
								return pairs
							}(),
						},
					},
				},
			},
		},
		{
			name:         "channel name updates are reflected in alert labels",
			orgToMigrate: 1,
			folders:      []*dashboards.Dashboard{f1, f2},
			dashboards:   []*dashboards.Dashboard{d1},

			initialLegacyState: legacyState{
				alerts:   modifiedAlerts(alerts1, withNotifiers),
				channels: channels1,
			},
			operations: []testOp{
				{
					description:     "initial migration",
					operation:       migrateOrgOp,
					expectedUAState: sh.uaState(t, channels1, modifiedPairs(pairs1, withNotifierLabels)),
				},
				{
					description: "update channel names and migrate single channel",
					updateLegacyState: &legacyState{
						channels: modifiedChannels(channels1, withModifiedChannelName),
					},
					operation: migrateChannelOp(channels1[9].ID),
					expectedUAState: modifiedState(sh.uaState(t,
						append(channels1[:9:9], modifiedChannels(channels1[9:10:10], withModifiedChannelName)...),
						append(modifiedPairs(pairs1[:9:9], withNotifierLabels), modifiedPairs(pairs1[9:10:10], func(a *migmodels.AlertPair) {
							withNotifiers(a.LegacyRule)
							a.Rule.Labels[contactLabel(fmt.Sprintf("notifiername%d-modified", a.LegacyRule.ID))] = "true"
						})...),
					), func(state *uaState) {
						for i := range pairs1 {
							// Service state knows the updated legacy channel names.
							state.serviceState.MigratedChannels[i].LegacyChannel.Name = channels1[i].Name + modifiedSuffix
						}
					}),
				},
				{
					description: "migrate the rest of the channels",
					operation:   migrateAllChannelsOp(false),
					expectedUAState: sh.uaState(t,
						modifiedChannels(channels1, withModifiedChannelName),
						modifiedPairs(pairs1, func(a *migmodels.AlertPair) {
							withNotifiers(a.LegacyRule)
							a.Rule.Labels[contactLabel(fmt.Sprintf("notifiername%d-modified", a.LegacyRule.ID))] = "true"
						}),
					),
				},
			},
		},
		{
			name:         "contact point name updates are reflected in alert labels",
			orgToMigrate: 1,
			folders:      []*dashboards.Dashboard{f1, f2},
			dashboards:   []*dashboards.Dashboard{d1},

			initialLegacyState: legacyState{
				alerts:   modifiedAlerts(alerts1, withNotifiers),
				channels: channels1,
			},
			initialUAState: modifiedState(sh.uaState(t, channels1, modifiedPairs(pairs1, withNotifierLabels)), func(state *uaState) {
				// Update all the contact points names. Done here so we simulate it being done post-migration.
				for i := 0; i < 10; i++ {
					state.amConfig.AlertmanagerConfig.Receivers[i+1].Name += modifiedSuffix
					state.amConfig.AlertmanagerConfig.Receivers[i+1].GrafanaManagedReceivers[0].Name += modifiedSuffix
					state.amConfig.AlertmanagerConfig.Route.Routes[0].Routes[i].Receiver += modifiedSuffix
				}
			}),
			operations: []testOp{
				{
					description: "re-migrated alerts should get the label to route to the correct contact point",
					operation:   migrateAllDashboardAlertsOp(false),
					expectedUAState: modifiedState(sh.uaState(t, channels1, modifiedPairs(pairs1, withNotifierLabels)), func(state *uaState) {
						for i := range pairs1 {
							state.serviceState.MigratedDashboards[0].MigratedAlerts[i].AlertRule.SendsTo = []string{channels1[i].Name + modifiedSuffix}
							state.serviceState.MigratedChannels[i].ContactPointUpgrade.Name += modifiedSuffix
						}
						for i := 0; i < 10; i++ {
							state.amConfig.AlertmanagerConfig.Receivers[i+1].Name += modifiedSuffix
							state.amConfig.AlertmanagerConfig.Receivers[i+1].GrafanaManagedReceivers[0].Name += modifiedSuffix
							state.amConfig.AlertmanagerConfig.Route.Routes[0].Routes[i].Receiver += modifiedSuffix
						}
					}),
				},
			},
		},
		{
			name:         "alert labels are correct when when alert is migrated before channel",
			orgToMigrate: 1,
			folders:      []*dashboards.Dashboard{f1, f2},
			dashboards:   []*dashboards.Dashboard{d1},

			initialLegacyState: legacyState{
				alerts:   modifiedAlerts(alerts1[:5:5], withNotifiers),
				channels: channels1[:5:5],
			},
			operations: []testOp{
				{
					description:     "initial migration of first 5 alerts and channels",
					operation:       migrateOrgOp,
					expectedUAState: sh.uaState(t, channels1[:5:5], modifiedPairs(pairs1[:5:5], withNotifierLabels)),
				},
				{
					description: "add the last 5 alerts and channels, migrate just the last 5 alerts",
					newLegacyState: &legacyState{
						alerts:   modifiedAlerts(alerts1[5:10:10], withNotifiers),
						channels: channels1[5:10:10],
					},
					operation: migrateAllDashboardAlertsOp(true),
				},
				{
					description:     "migrate the last 5 channels",
					operation:       migrateAllChannelsOp(true),
					expectedUAState: sh.uaState(t, channels1, modifiedPairs(pairs1, withNotifierLabels)),
				},
			},
		},
		{
			name:         "empty folders previously created by migration should be deleted",
			orgToMigrate: 1,
			folders:      []*dashboards.Dashboard{f1, f2},
			dashboards:   []*dashboards.Dashboard{d1},
			initialLegacyState: legacyState{
				alerts: alerts1,
			},
			initialUAState: &uaState{
				migState: &migrationStore.OrgMigrationState{
					OrgID:          1,
					CreatedFolders: []string{f1.UID},
				},
			},
			operations: []testOp{
				{
					description: "initial migration",
					operation:   migrateOrgOp,
					expectedUAState: func() *uaState {
						state := sh.uaState(t, nil, pairs1)
						state.migState.CreatedFolders = []string{f1.UID}
						return state
					}(),
				},
				{
					description: "move dashboard d1 to folder f2",
					operation: func(ctx context.Context, tt testcase, service *migrationService, x *xorm.Engine) error {
						d1Copy := *d1
						//nolint:staticcheck
						d1Copy.FolderID = f2.ID
						d1Copy.FolderUID = f2.UID
						_, err := x.ID(d1.ID).Update(d1Copy)
						return err
					},
				},
				{
					description: "migrate with skipExisting=false should move all the alerts to f2 and cleanup f1",
					operation:   migrateDashboardAlertsOp(false, d1.ID),
					expectedUAState: modifiedState(sh.uaState(t, nil, modifiedPairs(pairs1, func(p *migmodels.AlertPair) { p.Rule.NamespaceUID = f2.UID })), func(state *uaState) {
						state.serviceState.MigratedDashboards[0].FolderUID = f2.UID
						state.serviceState.MigratedDashboards[0].FolderName = f2.Title
					}),
				},
			},
		},
		{
			name:               "unmigrated channels should show up in GetOrgMigration state",
			orgToMigrate:       1,
			initialLegacyState: legacyState{channels: channels1},
			operations: []testOp{
				{
					operation: migrateChannelOp(channels1[0].ID),
					expectedUAState: modifiedState(sh.uaState(t, channels1[0:1:1]), func(state *uaState) {
						for _, c := range channels1[1:] {
							state.serviceState.MigratedChannels = append(state.serviceState.MigratedChannels, &definitions.ContactPair{
								LegacyChannel: fromLegacyChannel(c),
								Error:         "channel not upgraded",
							})
						}
					}),
				},
			},
		},
		{
			name:               "channels deleted after migration should show up in GetOrgMigration state",
			orgToMigrate:       1,
			initialLegacyState: legacyState{channels: channels1[0:9:9]},
			initialUAState:     sh.uaState(t, channels1), // Existing state has channels1[9].
			operations: []testOp{
				{
					expectedUAState: modifiedState(sh.uaState(t, channels1), func(state *uaState) {
						for _, c := range state.serviceState.MigratedChannels {
							if c.LegacyChannel.ID == channels1[9].ID {
								c.LegacyChannel = &definitions.LegacyChannel{ID: c.LegacyChannel.ID}
								c.Error = "channel no longer exists"
							}
						}
					}),
				},
			},
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			tcRun(t, tt)
		})
	}
}

var migrateOrgOp = func(ctx context.Context, tt testcase, service *migrationService, x *xorm.Engine) error {
	_, err := service.MigrateOrg(ctx, tt.orgToMigrate, tt.skipExisting)
	if err != nil {
		return err
	}
	return nil
}

var migrateAllDashboardAlertsOp = func(skipExisting bool) func(ctx context.Context, tt testcase, service *migrationService, x *xorm.Engine) error {
	return func(ctx context.Context, tt testcase, service *migrationService, x *xorm.Engine) error {
		_, err := service.MigrateAllDashboardAlerts(ctx, tt.orgToMigrate, skipExisting)
		if err != nil {
			return err
		}
		return nil
	}
}

var migrateAllChannelsOp = func(skipExisting bool) func(ctx context.Context, tt testcase, service *migrationService, x *xorm.Engine) error {
	return func(ctx context.Context, tt testcase, service *migrationService, x *xorm.Engine) error {
		_, err := service.MigrateAllChannels(ctx, tt.orgToMigrate, skipExisting)
		if err != nil {
			return err
		}
		return nil
	}
}

var migrateDashboardAlertsOp = func(skipExisting bool, ids ...int64) func(ctx context.Context, tt testcase, service *migrationService, x *xorm.Engine) error {
	return func(ctx context.Context, tt testcase, service *migrationService, x *xorm.Engine) error {
		for _, id := range ids {
			_, err := service.MigrateDashboardAlerts(ctx, tt.orgToMigrate, id, skipExisting)
			if err != nil {
				return err
			}
		}
		return nil
	}
}

var migrateChannelOp = func(ids ...int64) func(ctx context.Context, tt testcase, service *migrationService, x *xorm.Engine) error {
	return func(ctx context.Context, tt testcase, service *migrationService, x *xorm.Engine) error {
		for _, id := range ids {
			_, err := service.MigrateChannel(ctx, tt.orgToMigrate, id)
			if err != nil {
				return err
			}
		}
		return nil
	}
}

var migrateAlertOp = func(dashboardId int64, panelIds ...int64) func(ctx context.Context, tt testcase, service *migrationService, x *xorm.Engine) error {
	return func(ctx context.Context, tt testcase, service *migrationService, x *xorm.Engine) error {
		for _, id := range panelIds {
			_, err := service.MigrateAlert(ctx, tt.orgToMigrate, dashboardId, id)
			if err != nil {
				return err
			}
		}
		return nil
	}
}

func tcRun(t *testing.T, tt testcase) {
	sqlStore := db.InitTestDB(t)
	x := sqlStore.GetEngine()
	store := &store.DBstore{
		SQLStore: sqlStore,
		Logger:   &logtest.Fake{},
		Cfg: setting.UnifiedAlertingSettings{
			BaseInterval:                  10 * time.Second,
			DefaultRuleEvaluationInterval: time.Minute,
		},
	}
	service := NewTestMigrationService(t, sqlStore, &setting.Cfg{})
	defer teardown(t, x, service)
	setupLegacyAlertsTables(t, x, tt.initialLegacyState.channels, tt.initialLegacyState.alerts, tt.folders, tt.dashboards)
	if tt.initialUAState == nil {
		tt.initialUAState = &uaState{}
	}
	setupUATables(t, store, tt.orgToMigrate, tt.initialUAState.alerts, tt.initialUAState.amConfig)
	if tt.initialUAState.migState != nil {
		require.NoError(t, service.migrationStore.SetOrgMigrationState(context.Background(), tt.orgToMigrate, tt.initialUAState.migState))
	}

	if tt.dashboardPerms != nil {
		for uid, perms := range tt.dashboardPerms {
			_, err := service.migrationStore.SetDashboardPermissions(context.Background(), 1, uid, perms...)
			require.NoError(t, err)
		}
	}

	ctx := context.Background()
	require.NoError(t, service.migrationStore.SetMigrated(context.Background(), tt.orgToMigrate, true)) // To bypass verification.

	for _, op := range tt.operations {
		if op.description != "" {
			t.Logf("Running operation: %s", op.description)
		}
		if op.newLegacyState != nil {
			err := sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
				if len(op.newLegacyState.channels) > 0 {
					_, err := sess.Insert(op.newLegacyState.channels)
					require.NoError(t, err)
				}
				if len(op.newLegacyState.alerts) > 0 {
					_, err := sess.Insert(op.newLegacyState.alerts)
					require.NoError(t, err)
				}
				return nil
			})
			require.NoError(t, err)
		}
		if op.updateLegacyState != nil {
			err := sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
				for _, c := range op.updateLegacyState.channels {
					_, err := sess.ID(c.ID).Update(c)
					require.NoError(t, err)
				}
				for _, a := range op.updateLegacyState.alerts {
					_, err := sess.ID(a.ID).Update(a)
					require.NoError(t, err)
				}
				return nil
			})
			require.NoError(t, err)
		}

		if op.operation != nil {
			err := op.operation(ctx, tt, service, x)
			if len(op.expectedErrors) > 0 {
				for _, expErr := range op.expectedErrors {
					require.ErrorContains(t, err, expErr)
				}
				return
			}
			require.NoError(t, err)
		}

		if op.expectedUAState != nil {
			compareRules(t, x, tt.orgToMigrate, op.expectedUAState.alerts)
			compareAmConfig(t, x, tt.orgToMigrate, op.expectedUAState.amConfig)
			compareState(t, x, service, tt.orgToMigrate, op.expectedUAState.migState, op.expectedUAState.serviceState)
		}
	}
}

func compareRules(t *testing.T, x *xorm.Engine, orgId int64, expectedRules []*models.AlertRule) {
	if expectedRules == nil {
		return
	}
	rules := make([]*models.AlertRule, 0)
	err := x.Table("alert_rule").Where("org_id = ?", orgId).Find(&rules)
	require.NoError(t, err)

	cOpt := []cmp.Option{
		cmpopts.SortSlices(func(a, b models.AlertRule) bool {
			return a.Title < b.Title
		}),
		cmpopts.IgnoreUnexported(models.AlertRule{}, models.AlertQuery{}),
		cmpopts.IgnoreFields(models.AlertRule{}, "Updated", "UID", "ID", "Version", "ExecErrState"), // LOGZ.IO GRAFANA CHANGE :: DEV-46410 - Change default ExecErrState to OK and enforce OK value
	}
	if !cmp.Equal(expectedRules, rules, cOpt...) {
		t.Errorf("Unexpected Rule: %v", cmp.Diff(expectedRules, rules, cOpt...))
	}
}

func compareAmConfig(t *testing.T, x *xorm.Engine, orgId int64, expectedConfig *definitions.PostableUserConfig) {
	if expectedConfig == nil {
		return
	}
	amConfig := getAlertmanagerConfig(t, x, orgId)

	// Order of nested GrafanaManagedReceivers is not guaranteed.
	cOpt := []cmp.Option{
		cmpopts.IgnoreUnexported(definitions.PostableApiReceiver{}),
		cmpopts.IgnoreFields(definitions.PostableGrafanaReceiver{}, "UID", "SecureSettings"),
		cmpopts.SortSlices(func(a, b *definitions.PostableGrafanaReceiver) bool { return a.Name < b.Name }),
		cmpopts.SortSlices(func(a, b *definitions.PostableApiReceiver) bool { return a.Name < b.Name }),
	}
	if !cmp.Equal(expectedConfig.AlertmanagerConfig.Receivers, amConfig.AlertmanagerConfig.Receivers, cOpt...) {
		t.Errorf("Unexpected Receivers: %v", cmp.Diff(expectedConfig.AlertmanagerConfig.Receivers, amConfig.AlertmanagerConfig.Receivers, cOpt...))
	}

	// Order of routes is not guaranteed.
	cOpt = []cmp.Option{
		cmpopts.SortSlices(func(a, b *definitions.Route) bool {
			if a.Receiver != b.Receiver {
				return a.Receiver < b.Receiver
			}
			return a.ObjectMatchers[0].Value < b.ObjectMatchers[0].Value
		}),
		cmpopts.IgnoreUnexported(definitions.Route{}, labels.Matcher{}),
		cmpopts.IgnoreFields(definitions.Route{}, "GroupBy", "GroupByAll"),
	}
	if !cmp.Equal(expectedConfig.AlertmanagerConfig.Route, amConfig.AlertmanagerConfig.Route, cOpt...) {
		t.Errorf("Unexpected Route: %v", cmp.Diff(expectedConfig.AlertmanagerConfig.Route, amConfig.AlertmanagerConfig.Route, cOpt...))
	}
}

func compareState(t *testing.T, x *xorm.Engine, service *migrationService, orgId int64, expectedState *migrationStore.OrgMigrationState, expectedServiceState *definitions.OrgMigrationState) {
	if expectedState == nil && expectedServiceState == nil {
		return
	}

	// Assign real UIDS to expected state for comparison.
	type ruleUid struct {
		DashboardID int64  `xorm:"dashboard_id"`
		PanelID     int64  `xorm:"panel_id"`
		UID         string `xorm:"uid"`
	}
	ruleUids := make([]ruleUid, 0)
	err := x.SQL("SELECT d.id as dashboard_id, ar.panel_id, ar.uid FROM alert_rule ar INNER JOIN dashboard d ON d.uid = ar.dashboard_uid WHERE ar.org_id = ?", orgId).Find(&ruleUids)
	require.NoError(t, err)
	uidMap := make(map[string]string)
	for _, r := range ruleUids {
		if du, ok := expectedState.MigratedDashboards[r.DashboardID]; ok {
			if _, ok := du.MigratedAlerts[r.PanelID]; ok {
				uidMap[du.MigratedAlerts[r.PanelID].NewRuleUID] = r.UID
				du.MigratedAlerts[r.PanelID].NewRuleUID = r.UID
			}
		}
	}

	state, err := service.migrationStore.GetOrgMigrationState(context.Background(), orgId)
	require.NoError(t, err)

	cOpt := []cmp.Option{
		cmpopts.SortSlices(func(a, b string) bool { return a < b }),
		cmpopts.EquateEmpty(),
	}
	if !cmp.Equal(expectedState, state, cOpt...) {
		t.Errorf("Unexpected OrgMigrationState: %v", cmp.Diff(expectedState, state, cOpt...))
	}

	if expectedServiceState != nil {
		for _, du := range expectedServiceState.MigratedDashboards {
			for _, a := range du.MigratedAlerts {
				if a.AlertRule != nil {
					a.AlertRule.UID = uidMap[a.AlertRule.UID]
				}
			}
		}

		serviceState, err := service.GetOrgMigrationState(context.Background(), orgId)
		require.NoError(t, err)

		cOpt := []cmp.Option{
			cmpopts.SortSlices(func(a, b *definitions.DashboardUpgrade) bool { return a.DashboardID < b.DashboardID }),
			cmpopts.SortSlices(func(a, b *definitions.AlertPair) bool { return a.LegacyAlert.ID < b.LegacyAlert.ID }),
			cmpopts.SortSlices(func(a, b *definitions.ContactPair) bool { return a.LegacyChannel.ID < b.LegacyChannel.ID }),
			cmpopts.IgnoreUnexported(labels.Matcher{}),
			cmpopts.EquateEmpty(),
		}
		if !cmp.Equal(expectedServiceState, serviceState, cOpt...) {
			t.Errorf("Unexpected OrgMigrationState: %v", cmp.Diff(expectedServiceState, serviceState, cOpt...))
		}
	}
}

// setupUATables inserts data into the UA tables.
func setupUATables(t *testing.T, store *store.DBstore, orgID int64, rules []*models.AlertRule, amConfig *definitions.PostableUserConfig) {
	t.Helper()
	ctx := context.Background()

	rs := make([]models.AlertRule, 0, len(rules))
	for _, r := range rules {
		rs = append(rs, *r)
	}

	if len(rs) > 0 {
		_, err := store.InsertAlertRules(ctx, rs)
		require.NoError(t, err)
	}

	if amConfig != nil {
		rawAmConfig, err := json.Marshal(amConfig)
		require.NoError(t, err)
		cmd := models.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: string(rawAmConfig),
			ConfigurationVersion:      fmt.Sprintf("v%d", models.AlertConfigurationVersion),
			Default:                   false,
			OrgID:                     orgID,
			LastApplied:               0,
		}
		err = store.SaveAlertmanagerConfiguration(ctx, &cmd)
		require.NoError(t, err)
	}
}

func createPostableUserConfig(t *testing.T, channels ...*legacymodels.AlertNotification) *definitions.PostableUserConfig {
	t.Helper()
	am := &definitions.PostableUserConfig{
		AlertmanagerConfig: definitions.PostableApiAlertingConfig{
			Config: definitions.Config{Route: &definitions.Route{
				Receiver:   "autogen-contact-point-default",
				GroupByStr: []string{models.FolderTitleLabel, model.AlertNameLabel},
				Routes: []*definitions.Route{
					{
						ObjectMatchers: definitions.ObjectMatchers{{Type: labels.MatchEqual, Name: models.MigratedUseLegacyChannelsLabel, Value: "true"}},
						Continue:       true,
						Routes:         []*definitions.Route{},
					},
				},
			}},
			Receivers: []*definitions.PostableApiReceiver{
				{Receiver: config.Receiver{Name: "autogen-contact-point-default"}, PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{}},
			},
		},
	}
	for _, c := range channels {
		settings, err := c.Settings.MarshalJSON()
		require.NoError(t, err)
		am.AlertmanagerConfig.Receivers = append(am.AlertmanagerConfig.Receivers, &definitions.PostableApiReceiver{Receiver: config.Receiver{Name: c.Name}, PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{{UID: c.UID, Name: c.Name, Type: c.Type, Settings: settings}}}})
		am.AlertmanagerConfig.Route.Routes[0].Routes = append(am.AlertmanagerConfig.Route.Routes[0].Routes, &definitions.Route{Receiver: c.Name, ObjectMatchers: definitions.ObjectMatchers{{Type: labels.MatchEqual, Name: contactLabel(c.Name), Value: "true"}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)})
	}
	return am
}

type serviceHelper struct {
	t           *testing.T
	dashIncr    int64
	alertIncr   int64
	ruleIncr    int64
	channelIncr int64

	dashes       map[int64]*dashboards.Dashboard
	folders      map[int64]*dashboards.Dashboard
	foldersByUID map[string]*dashboards.Dashboard
}

func newServiceHelper(t *testing.T) serviceHelper {
	return serviceHelper{
		t:           t,
		dashIncr:    int64(1),
		alertIncr:   int64(1),
		ruleIncr:    int64(1),
		channelIncr: int64(1),

		dashes:       make(map[int64]*dashboards.Dashboard),
		folders:      make(map[int64]*dashboards.Dashboard),
		foldersByUID: make(map[string]*dashboards.Dashboard),
	}
}

func (h *serviceHelper) genAlerts(d *dashboards.Dashboard, cnt int) []*legacymodels.Alert {
	d.Title = fmt.Sprintf("dash title%d", h.dashIncr)
	alerts := make([]*legacymodels.Alert, 0, cnt)

	for i := 0; i < cnt; i++ {
		a := createAlertWithCond(h.t, 1, int(d.ID), int(h.alertIncr), fmt.Sprintf("alert%d", h.alertIncr), nil,
			[]dashAlertCondition{createCondition("A", "max", "gt", 42, 1, "5m", "now")})
		a.ID = h.alertIncr

		alerts = append(alerts, a)
		h.alertIncr++
	}
	h.dashIncr++
	return alerts
}

func (h *serviceHelper) genFolder() *dashboards.Dashboard {
	f := createFolder(h.t, h.dashIncr, 1, fmt.Sprintf("folder%d", h.dashIncr))
	h.dashIncr++
	h.folders[f.ID] = f
	h.foldersByUID[f.UID] = f
	return f
}

func (h *serviceHelper) genDash(folder *dashboards.Dashboard) *dashboards.Dashboard {
	d := createDashboard(h.t, h.dashIncr, 1, fmt.Sprintf("dash%d", h.dashIncr), folder.UID, folder.ID, nil)
	d.Title = fmt.Sprintf("dash title%d", h.dashIncr)

	h.dashIncr++
	h.dashes[d.ID] = d
	return d
}

func (h *serviceHelper) genChannels(cnt int) []*legacymodels.AlertNotification {
	channels := make([]*legacymodels.AlertNotification, 0, cnt)
	for i := 0; i < cnt; i++ {
		c := createAlertNotification(h.t, int64(1), fmt.Sprintf("notifier%d", h.channelIncr), "email", emailSettings, false)
		c.Name = fmt.Sprintf("notifiername%d", h.channelIncr)
		c.ID = h.channelIncr
		channels = append(channels, c)
		h.channelIncr++
	}
	return channels
}

func (h *serviceHelper) genAlertPairs(f *dashboards.Dashboard, d *dashboards.Dashboard, alerts []*legacymodels.Alert) ([]*models.AlertRule, []*migmodels.AlertPair) {
	pairs := make([]*migmodels.AlertPair, 0, len(alerts))
	rules := make([]*models.AlertRule, 0, len(alerts))
	for _, a := range alerts {
		uid := util.GenerateShortUID()
		r := &models.AlertRule{
			UID:       uid,
			ID:        h.ruleIncr,
			OrgID:     1,
			Title:     a.Name,
			Condition: "B",
			Data: []models.AlertQuery{createAlertQuery("A", "ds1-1", "5m", "now"), createClassicConditionQuery("B", []classicCondition{
				cond("A", "max", "gt", 42),
			})},
			IntervalSeconds: 60,
			Version:         1,
			NamespaceUID:    f.UID,
			DashboardUID:    pointer(d.UID),
			PanelID:         pointer(a.PanelID),
			RuleGroup:       fmt.Sprintf("%s - 1m", d.Title),
			RuleGroupIndex:  1,
			NoDataState:     models.NoData,
			ExecErrState:    models.AlertingErrState,
			For:             60 * time.Second,
			Annotations: map[string]string{
				models.MigratedAlertIdAnnotation: fmt.Sprintf("%d", a.ID),
				models.MigratedMessageAnnotation: "message",
				models.DashboardUIDAnnotation:    d.UID,
				models.PanelIDAnnotation:         fmt.Sprintf("%d", a.PanelID),
			},
			Labels: map[string]string{
				models.MigratedUseLegacyChannelsLabel: "true",
			},
			IsPaused: false,
		}
		for _, v := range extractChannelIds(h.t, a) {
			id := v.ID
			if id != 0 {
				// Relies on the naming pattern.
				r.Labels[contactLabel(fmt.Sprintf("notifiername%d", id))] = "true"
			}
		}
		rules = append(rules, r)
		pairs = append(pairs, &migmodels.AlertPair{
			LegacyRule: a,
			Rule:       r,
		})
		h.ruleIncr++
	}
	return rules, pairs
}

func (h *serviceHelper) dashUpgrade(dashboardID int64, alertFolderUID string, migPairs []*migmodels.AlertPair, warning string) *migrationStore.DashboardUpgrade {
	return &migrationStore.DashboardUpgrade{
		DashboardID:    dashboardID,
		AlertFolderUID: alertFolderUID,
		MigratedAlerts: func() map[int64]*migrationStore.AlertPair {
			pairs := make(map[int64]*migrationStore.AlertPair, len(migPairs))
			for _, p := range migPairs {
				channelsIds := make([]int64, 0)
				for _, v := range extractChannelIds(h.t, p.LegacyRule) {
					channelsIds = append(channelsIds, v.ID)
				}
				pair := migrationStore.AlertPair{
					LegacyID:   p.LegacyRule.ID,
					PanelID:    p.LegacyRule.PanelID,
					NewRuleUID: p.Rule.UID,
					ChannelIDs: channelsIds,
				}
				if p.Error != nil {
					pair.Error = p.Error.Error()
				}
				pairs[p.LegacyRule.PanelID] = &pair
			}
			return pairs
		}(),
		Warning: warning,
	}
}

func (h *serviceHelper) contactPairs(c ...*legacymodels.AlertNotification) map[int64]*migrationStore.ContactPair {
	pairs := make(map[int64]*migrationStore.ContactPair, len(c))
	for _, ch := range c {
		pairs[ch.ID] = &migrationStore.ContactPair{
			LegacyID:       ch.ID,
			NewReceiverUID: ch.UID,
			Error:          "",
		}
	}
	return pairs
}

func (h *serviceHelper) uaState(t *testing.T, channels []*legacymodels.AlertNotification, dashPairs ...[]*migmodels.AlertPair) *uaState {
	s := &uaState{
		migState: &migrationStore.OrgMigrationState{
			OrgID: 1,
		},
		serviceState: h.serviceState(channels, dashPairs...),
	}

	if len(channels) > 0 {
		s.amConfig = createPostableUserConfig(t, channels...)
		s.migState.MigratedChannels = h.contactPairs(channels...)
	}

	if len(dashPairs) > 0 {
		s.migState.MigratedDashboards = map[int64]*migrationStore.DashboardUpgrade{}
		for _, pairs := range dashPairs {
			for _, p := range pairs {
				s.alerts = append(s.alerts, p.Rule)
			}
			s.migState.MigratedDashboards[pairs[0].LegacyRule.DashboardID] = h.dashUpgrade(pairs[0].LegacyRule.DashboardID, pairs[0].Rule.NamespaceUID, pairs, "")
		}
	}

	return s
}

func (h *serviceHelper) serviceState(channels []*legacymodels.AlertNotification, dashPairs ...[]*migmodels.AlertPair) *definitions.OrgMigrationState {
	state := &definitions.OrgMigrationState{
		OrgID:              1,
		MigratedDashboards: []*definitions.DashboardUpgrade{},
		MigratedChannels:   []*definitions.ContactPair{},
	}
	channelName := make(map[int64]string)
	for _, c := range channels {
		channelName[c.ID] = c.Name
	}

	for _, pairs := range dashPairs {
		d := h.dashes[pairs[0].LegacyRule.DashboardID]
		//nolint:staticcheck
		f := h.folders[d.FolderID]
		f2 := h.foldersByUID[pairs[0].Rule.NamespaceUID]
		du := &definitions.DashboardUpgrade{
			DashboardID:   d.ID,
			DashboardUID:  d.UID,
			DashboardName: d.Title,
			FolderUID:     f.UID,
			FolderName:    f.Title,
			NewFolderUID:  f2.UID,
			NewFolderName: f2.Title,
			Provisioned:   false,
			Warning:       "",
		}
		for _, pair := range pairs {
			var sendsTo []string
			for _, v := range extractChannelIds(h.t, pair.LegacyRule) {
				sendsTo = append(sendsTo, channelName[v.ID])
			}
			if len(sendsTo) == 0 {
				sendsTo = []string{"autogen-contact-point-default"}
			}
			p := &definitions.AlertPair{
				LegacyAlert: fromLegacyAlert(pair.LegacyRule),
				AlertRule:   fromAlertRuleUpgrade(pair.Rule, sendsTo),
			}
			if pair.Error != nil {
				p.Error = pair.Error.Error()
			}
			du.MigratedAlerts = append(du.MigratedAlerts, p)
		}
		state.MigratedDashboards = append(state.MigratedDashboards, du)
	}
	if len(channels) > 0 {
		for _, c := range channels {
			route, _ := createRoute(c, c.Name)
			state.MigratedChannels = append(state.MigratedChannels, &definitions.ContactPair{
				LegacyChannel: fromLegacyChannel(c),
				ContactPointUpgrade: &definitions.ContactPointUpgrade{
					Name:          c.Name,
					Type:          c.Type,
					RouteMatchers: route.ObjectMatchers,
				},
			})
		}
	}
	return state
}

func copyMap(m map[string]string) map[string]string {
	c := make(map[string]string, len(m))
	for k, v := range m {
		c[k] = v
	}
	return c
}

func copyAlerts(alerts ...*legacymodels.Alert) []*legacymodels.Alert {
	copies := make([]*legacymodels.Alert, len(alerts))
	for i, a := range alerts {
		c := *a
		settingsMap := c.Settings.MustMap()
		c.Settings = simplejson.New()
		for k, v := range settingsMap {
			c.Settings.Set(k, v)
		}

		copies[i] = &c
	}
	return copies
}

func copyRules(rules ...*models.AlertRule) []*models.AlertRule {
	copies := make([]*models.AlertRule, len(rules))
	for i, a := range rules {
		c := *a
		c.Labels = copyMap(c.Labels)
		c.Annotations = copyMap(c.Annotations)
		copies[i] = &c
	}
	return copies
}

func copyChannels(channels ...*legacymodels.AlertNotification) []*legacymodels.AlertNotification {
	copies := make([]*legacymodels.AlertNotification, len(channels))
	for i, a := range channels {
		c := *a
		copies[i] = &c
	}
	return copies
}

func copyPairs(pairs ...*migmodels.AlertPair) []*migmodels.AlertPair {
	newPairs := make([]*migmodels.AlertPair, len(pairs))
	for i, pair := range pairs {
		clr := copyAlerts(pair.LegacyRule)[0]
		cr := copyRules(pair.Rule)[0]
		newPairs[i] = &migmodels.AlertPair{
			LegacyRule: clr,
			Rule:       cr,
			Error:      pair.Error,
		}
	}
	return newPairs
}

func extractChannelIds(t *testing.T, alert *legacymodels.Alert) []notificationKey {
	b, err := alert.Settings.Get("notifications").ToDB()
	if err == nil && b != nil {
		require.NoError(t, err)
		var nots []notificationKey
		err = json.Unmarshal(b, &nots)
		require.NoError(t, err)

		return nots
	}
	return nil
}

func fromLegacyAlert(alert *legacymodels.Alert) *definitions.LegacyAlert {
	if alert == nil {
		return nil
	}
	return &definitions.LegacyAlert{
		ID:          alert.ID,
		DashboardID: alert.DashboardID,
		PanelID:     alert.PanelID,
		Name:        alert.Name,
	}
}

func fromAlertRuleUpgrade(rule *models.AlertRule, sendsTo []string) *definitions.AlertRuleUpgrade {
	if rule == nil {
		return nil
	}
	return &definitions.AlertRuleUpgrade{
		UID:     rule.UID,
		Title:   rule.Title,
		SendsTo: sendsTo,
	}
}

func fromLegacyChannel(channel *legacymodels.AlertNotification) *definitions.LegacyChannel {
	if channel == nil {
		return nil
	}
	return &definitions.LegacyChannel{
		ID:   channel.ID,
		Name: channel.Name,
		Type: channel.Type,
	}
}

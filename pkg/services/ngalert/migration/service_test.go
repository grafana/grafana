package migration

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
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
		createDashboard(t, 1, 1, "dash1-1", 5, nil),
		createDashboard(t, 2, 1, "dash2-1", 5, nil),
		createDashboard(t, 8, 1, "dash-in-general-1", 0, nil),
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
			ForceMigration: true,
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
			createDashboard(t, 99, 1, "dash-in-general-alerting-1", generalAlertingFolder.ID, nil),
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

	t.Run("ForceMigration story", func(t *testing.T) {
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

		// Disable UA without ForceMigration.
		// This run should throw an error.
		service.cfg.UnifiedAlerting.Enabled = pointer(false)
		require.ErrorContains(t, service.Run(ctx), ForceMigrationError.Error())
		checkAlertingType(t, ctx, service, migrationStore.UnifiedAlerting)
		checkMigrationStatus(t, ctx, service, 1, true)
		checkAlertRulesCount(t, x, 1, 1)

		// Disable UA with force flag.
		// This run should not revert UA data.
		service.cfg.UnifiedAlerting.Enabled = pointer(false)
		service.cfg.ForceMigration = true
		require.NoError(t, service.Run(ctx))
		checkAlertingType(t, ctx, service, migrationStore.Legacy)
		checkMigrationStatus(t, ctx, service, 1, false)
		checkAlertRulesCount(t, x, 1, 0) // Alerts are gone.

		// Add another alert.
		_, alertErr := x.Insert(createAlert(t, 1, 1, 2, "alert2", []string{"notifier1"}))
		require.NoError(t, alertErr)

		// Enable UA.
		// This run should remigrate org, new alert is migrated.
		service.cfg.UnifiedAlerting.Enabled = pointer(true)
		require.NoError(t, service.Run(ctx))
		checkAlertingType(t, ctx, service, migrationStore.UnifiedAlerting)
		checkMigrationStatus(t, ctx, service, 1, true)
		checkAlertRulesCount(t, x, 1, 2) // Now we have 2
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

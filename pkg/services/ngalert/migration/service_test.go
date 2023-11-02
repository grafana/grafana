package migration

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

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
			ForceMigration: true,
			UnifiedAlerting: setting.UnifiedAlertingSettings{
				Enabled: pointer(true),
			},
		}
		service := NewTestMigrationService(t, sqlStore, cfg)

		err = service.migrationStore.SetMigrated(ctx, false)
		require.NoError(t, err)

		err = service.Run(ctx)
		require.NoError(t, err)

		// Verify migration was run.
		migrated, err := service.migrationStore.IsMigrated(ctx)
		require.NoError(t, err)
		require.Equal(t, true, migrated)

		// Currently, we fill in some random data for tables that aren't populated during migration.
		_, err = x.Table("ngalert_configuration").Insert(models.AdminConfiguration{})
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
		tables := []string{
			"alert_rule",
			"alert_rule_version",
			"alert_configuration",
			"ngalert_configuration",
			"alert_instance",
		}
		for _, table := range tables {
			count, err := x.Table(table).Count()
			require.NoError(t, err)
			require.True(t, count > 0, "table %s should have at least one row", table)
		}

		// Revert migration.
		service.cfg.UnifiedAlerting.Enabled = pointer(false)
		err = service.Run(context.Background())
		require.NoError(t, err)

		// Verify revert was run.
		migrated, err = service.migrationStore.IsMigrated(ctx)
		require.NoError(t, err)
		require.Equal(t, false, migrated)

		// Verify various UA resources are gone
		for _, table := range tables {
			count, err := x.Table(table).Count()
			require.NoError(t, err)
			require.Equal(t, int64(0), count, "table %s should have no rows", table)
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
			ForceMigration: true,
			UnifiedAlerting: setting.UnifiedAlertingSettings{
				Enabled: pointer(true),
			},
		}
		service := NewTestMigrationService(t, sqlStore, cfg)

		err = service.migrationStore.SetMigrated(ctx, false)
		require.NoError(t, err)

		err = service.Run(ctx)
		require.NoError(t, err)

		// Verify migration was run.
		migrated, err := service.migrationStore.IsMigrated(ctx)
		require.NoError(t, err)
		require.Equal(t, true, migrated)

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
		service.cfg.UnifiedAlerting.Enabled = pointer(false)
		err = service.Run(context.Background())
		require.NoError(t, err)

		// Verify revert was run.
		migrated, err = service.migrationStore.IsMigrated(ctx)
		require.NoError(t, err)
		require.Equal(t, false, migrated)

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

		err = service.migrationStore.SetMigrated(ctx, false)
		require.NoError(t, err)

		err = service.Run(ctx)
		require.NoError(t, err)

		// Verify migration was run.
		migrated, err := service.migrationStore.IsMigrated(ctx)
		require.NoError(t, err)
		require.Equal(t, true, migrated)

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
		service.cfg.UnifiedAlerting.Enabled = pointer(false)
		err = service.Run(ctx)
		require.NoError(t, err)

		// Verify revert was run.
		migrated, err = service.migrationStore.IsMigrated(ctx)
		require.NoError(t, err)
		require.Equal(t, false, migrated)

		// Verify we are back to the original count + 2.
		newDashCount, err = x.Table("dashboard").Count(&dashboards.Dashboard{})
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
}

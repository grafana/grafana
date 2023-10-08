package migration

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

// actionName is the unique row-level lock name for serverlock.ServerLockService.
const actionName = "alerting migration"

const anyOrg = 0

type MigrationService struct {
	lock           *serverlock.ServerLockService
	mtx            sync.Mutex
	cfg            *setting.Cfg
	log            log.Logger
	store          db.DB
	migrationStore migrationStore.Store

	encryptionService secrets.Service
}

func ProvideService(
	lock *serverlock.ServerLockService,
	cfg *setting.Cfg,
	store db.DB,
	migrationStore migrationStore.Store,
	encryptionService secrets.Service,
) (*MigrationService, error) {
	return &MigrationService{
		lock:              lock,
		log:               log.New("ngalert.migration"),
		cfg:               cfg,
		store:             store,
		migrationStore:    migrationStore,
		encryptionService: encryptionService,
	}, nil
}

// MigrateChannel migrates a single legacy notification channel to a unified alerting contact point.
func (ms *MigrationService) MigrateChannel(ctx context.Context, orgID int64, channelID int64, skipExisting bool) (migmodels.OrgMigrationSummary, error) {
	ms.mtx.Lock()
	defer ms.mtx.Unlock()
	var summary migmodels.OrgMigrationSummary
	err := ms.store.InTransaction(ctx, func(ctx context.Context) error {
		om := ms.newOrgMigration(orgID)
		state, err := om.migrationStore.GetOrgMigrationState(ctx, orgID)
		if err != nil {
			return fmt.Errorf("get org migration summary: %w", err)
		}
		om.state = state

		cfg, err := om.migrationStore.GetAlertmanagerConfig(ctx, om.orgID)
		if err != nil {
			return fmt.Errorf("get alertmanager config: %w", err)
		}

		amConfig := migmodels.FromPostableUserConfig(cfg)
		if skipExisting {
			existing := om.state.PopContactPair(channelID)
			if existing != nil {
				return fmt.Errorf("notification channel already migrated")
			}
		} else {
			amConfig.CleanupReceiversAndRoutes(om.state.PopContactPair(channelID))
		}

		channel, err := om.migrationStore.GetNotificationChannel(ctx, orgID, channelID)
		if err != nil && !errors.Is(err, migrationStore.ErrNotFound) {
			return fmt.Errorf("get notification channel: %w", err)
		}
		if err != nil && errors.Is(err, migrationStore.ErrNotFound) {
			// Notification channel no longer exists, delete this record from the state.
			om.log.Debug("Notification channel no longer exists", "channelID", channelID)
			summary.Removed = true
		} else {
			pairs, err := om.migrateAndSaveChannels(ctx, []*legacymodels.AlertNotification{channel}, amConfig)
			if err != nil {
				return err
			}
			summary.CountChannels(pairs...)
		}

		err = ms.migrationStore.SetOrgMigrationState(ctx, orgID, om.state)
		if err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return migmodels.OrgMigrationSummary{}, err
	}

	return summary, nil
}

// MigrateAllChannels migrates all legacy notification channel to unified alerting contact points.
func (ms *MigrationService) MigrateAllChannels(ctx context.Context, orgID int64, skipExisting bool) (migmodels.OrgMigrationSummary, error) {
	ms.mtx.Lock()
	defer ms.mtx.Unlock()
	var summary migmodels.OrgMigrationSummary
	err := ms.store.InTransaction(ctx, func(ctx context.Context) error {
		om := ms.newOrgMigration(orgID)
		state, err := om.migrationStore.GetOrgMigrationState(ctx, orgID)
		if err != nil {
			return fmt.Errorf("get org migration summary: %w", err)
		}
		om.state = state

		s, err := om.migrateOrgChannels(ctx, skipExisting)
		if err != nil {
			om.state.AddError(err.Error())
		}

		err = ms.migrationStore.SetOrgMigrationState(ctx, orgID, om.state)
		if err != nil {
			return err
		}

		summary.Add(s)
		return nil
	})
	if err != nil {
		return migmodels.OrgMigrationSummary{}, err
	}

	return summary, nil
}

// MigrateAlert migrates a single dashboard alert from legacy alerting to unified alerting.
func (ms *MigrationService) MigrateAlert(ctx context.Context, orgID int64, dashboardID int64, panelID int64, skipExisting bool) (migmodels.OrgMigrationSummary, error) {
	ms.mtx.Lock()
	defer ms.mtx.Unlock()
	var summary migmodels.OrgMigrationSummary
	err := ms.store.InTransaction(ctx, func(ctx context.Context) error {
		om := ms.newOrgMigration(orgID)
		state, err := om.migrationStore.GetOrgMigrationState(ctx, orgID)
		if err != nil {
			return fmt.Errorf("get org migration summary: %w", err)
		}
		om.state = state

		// Cleanup.
		var du *migmodels.DashboardUpgrade
		if skipExisting {
			du = om.state.GetDashboardUpgrade(dashboardID)
			if du != nil {
				existing := du.PopAlertPair(panelID)
				if existing != nil {
					return fmt.Errorf("alert already migrated")
				}
			}
		} else {
			du = om.state.GetDashboardUpgrade(dashboardID)
			if du != nil {
				existingPair := du.PopAlertPair(panelID)
				if existingPair != nil && existingPair.AlertRule != nil && existingPair.AlertRule.UID != "" {
					err := om.migrationStore.DeleteAlertRules(ctx, orgID, existingPair.AlertRule.UID)
					if err != nil {
						return fmt.Errorf("delete existing alert rule: %w", err)
					}
				}
			}
		}
		if du == nil {
			return fmt.Errorf("dashboard not migrated")
		}

		alert, err := ms.migrationStore.GetDashboardAlert(ctx, orgID, dashboardID, panelID)
		if err != nil && !errors.Is(err, migrationStore.ErrNotFound) {
			return fmt.Errorf("get alert: %w", err)
		}

		if err != nil && errors.Is(err, migrationStore.ErrNotFound) {
			// Legacy alert no longer exists, delete this record from the state.
			om.log.Debug("Alert no longer exists", "dashboardID", dashboardID, "panelID", panelID)
			summary.Removed = true
		} else {
			pairs, err := om.migrateAndSaveAlerts(ctx, []*legacymodels.Alert{alert}, *du.DashboardUpgradeInfo)
			if err != nil {
				om.log.Warn("Failed to migrate dashboard alert", "error", err)
				pairs = du.AddAlertErrors(err, alert)
			}
			du.MigratedAlerts = append(du.MigratedAlerts, pairs...)

			summary.CountDashboardAlerts(pairs...)
		}

		// We don't create new folders here, so no need to upgrade summary.CreatedFolders.
		err = ms.migrationStore.SetOrgMigrationState(ctx, orgID, om.state)
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return migmodels.OrgMigrationSummary{}, err
	}

	return summary, nil
}

// MigrateDashboardAlerts migrates all legacy dashboard alerts from a single dashboard to unified alerting.
func (ms *MigrationService) MigrateDashboardAlerts(ctx context.Context, orgID int64, dashboardID int64, skipExisting bool) (migmodels.OrgMigrationSummary, error) {
	ms.mtx.Lock()
	defer ms.mtx.Unlock()
	var summary migmodels.OrgMigrationSummary
	err := ms.store.InTransaction(ctx, func(ctx context.Context) error {
		om := ms.newOrgMigration(orgID)
		state, err := om.migrationStore.GetOrgMigrationState(ctx, orgID)
		if err != nil {
			return fmt.Errorf("get org migration summary: %w", err)
		}
		om.state = state

		alerts, err := ms.migrationStore.GetDashboardAlerts(ctx, orgID, dashboardID)
		if err != nil {
			return fmt.Errorf("get alerts: %w", err)
		}

		du, sum, err := om.migrateAndSaveDashboard(ctx, dashboardID, alerts, skipExisting)
		if err != nil {
			return err
		}
		om.state.AddDashboardUpgrade(du)

		err = ms.migrationStore.SetOrgMigrationState(ctx, orgID, om.state)
		if err != nil {
			return err
		}
		summary.Add(sum)
		return nil
	})
	if err != nil {
		return migmodels.OrgMigrationSummary{}, err
	}

	return summary, nil
}

// MigrateAllDashboardAlerts migrates all legacy alerts to unified alerting contact points.
func (ms *MigrationService) MigrateAllDashboardAlerts(ctx context.Context, orgID int64, skipExisting bool) (migmodels.OrgMigrationSummary, error) {
	ms.mtx.Lock()
	defer ms.mtx.Unlock()
	var summary migmodels.OrgMigrationSummary
	err := ms.store.InTransaction(ctx, func(ctx context.Context) error {
		om := ms.newOrgMigration(orgID)
		state, err := om.migrationStore.GetOrgMigrationState(ctx, orgID)
		if err != nil {
			return fmt.Errorf("get org migration summary: %w", err)
		}
		om.state = state

		summary, err = om.migrateOrgAlerts(ctx, skipExisting)
		if err != nil {
			om.state.AddError(err.Error())
		}

		err = ms.migrationStore.SetOrgMigrationState(ctx, orgID, om.state)
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return migmodels.OrgMigrationSummary{}, err
	}

	return summary, nil
}

// MigrateOrg executes the migration for a single org.
func (ms *MigrationService) MigrateOrg(ctx context.Context, orgID int64, skipExisting bool) (migmodels.OrgMigrationSummary, error) {
	ms.mtx.Lock()
	defer ms.mtx.Unlock()
	var summary migmodels.OrgMigrationSummary
	err := ms.store.InTransaction(ctx, func(ctx context.Context) error {
		ms.log.Info("Starting legacy migration for org", "orgID", orgID, "skipExisting", skipExisting)
		om := ms.newOrgMigration(orgID)
		state, err := om.migrationStore.GetOrgMigrationState(ctx, orgID)
		if err != nil {
			return fmt.Errorf("get org migration summary: %w", err)
		}
		om.state = state

		summary, err = om.migrateOrg(ctx, skipExisting)
		if err != nil {
			return fmt.Errorf("migrate org: %w", err)
		}

		err = om.migrationStore.SetOrgMigrationState(ctx, orgID, om.state)
		if err != nil {
			return err
		}
		err = om.migrationStore.SetMigrated(ctx, orgID, true)
		if err != nil {
			return fmt.Errorf("setting migration status: %w", err)
		}

		return nil
	})
	if err != nil {
		return migmodels.OrgMigrationSummary{}, err
	}

	return summary, nil
}

func (ms *MigrationService) GetOrgMigrationState(ctx context.Context, orgID int64) (*migmodels.OrgMigrationState, error) {
	ms.mtx.Lock()
	defer ms.mtx.Unlock()
	var state *migmodels.OrgMigrationState
	err := ms.store.InTransaction(ctx, func(ctx context.Context) error {
		var err error
		state, err = ms.migrationStore.GetOrgMigrationState(ctx, orgID)
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return state, nil
}

// Run starts the migration, any migration issues will throw an error.
// If we are moving from legacy->UA:
//   - All orgs without their migration status set to true in the kvstore will be migrated.
//   - If ForceMigration=true, then UA will be reverted first. So, all orgs will be migrated from scratch.
//
// If we are moving from UA->legacy:
//   - No-op except to set a kvstore flag with orgId=0 that lets us determine when we move from legacy->UA. No UA resources are deleted or reverted.
func (ms *MigrationService) Run(ctx context.Context) error {
	ms.mtx.Lock()
	defer ms.mtx.Unlock()
	var errMigration error
	errLock := ms.lock.LockExecuteAndRelease(ctx, actionName, time.Minute*10, func(context.Context) {
		ms.log.Info("Starting")
		errMigration = ms.store.InTransaction(ctx, func(ctx context.Context) error {
			migrated, err := ms.migrationStore.IsMigrated(ctx, anyOrg)
			if err != nil {
				return fmt.Errorf("getting migration status: %w", err)
			}

			if !ms.cfg.UnifiedAlerting.IsEnabled() {
				// Set status to false so that next time UA is enabled, we run the migration again. That is when
				// ForceMigration will be checked to determine if revert should happen.
				err = ms.migrationStore.SetMigrated(ctx, anyOrg, false)
				if err != nil {
					return fmt.Errorf("setting migration status: %w", err)
				}
				return nil
			}

			if migrated {
				ms.log.Info("Migration already run")
				return nil
			}

			// Safeguard to prevent data loss.
			if ms.cfg.ForceMigration {
				ms.log.Info("ForceMigration enabled, reverting and migrating orgs from scratch")
				// Revert migration
				ms.log.Info("Reverting legacy migration")
				err := ms.migrationStore.RevertAllOrgs(ctx)
				if err != nil {
					return fmt.Errorf("reverting migration: %w", err)
				}
				ms.log.Info("Legacy migration reverted")
			}

			ms.log.Info("Starting legacy migration")
			err = ms.migrateAllOrgs(ctx)
			if err != nil {
				return fmt.Errorf("executing migration: %w", err)
			}

			err = ms.migrationStore.SetMigrated(ctx, anyOrg, true)
			if err != nil {
				return fmt.Errorf("setting migration status: %w", err)
			}

			ms.log.Info("Completed legacy migration")
			return nil
		})
	})
	if errLock != nil {
		ms.log.Warn("Server lock for alerting migration already exists")
		return nil
	}
	if errMigration != nil {
		return fmt.Errorf("migration failed: %w", errMigration)
	}
	return nil
}

// migrateAllOrgs executes the migration for all orgs.
func (ms *MigrationService) migrateAllOrgs(ctx context.Context) error {
	orgs, err := ms.migrationStore.GetAllOrgs(ctx)
	if err != nil {
		return fmt.Errorf("get orgs: %w", err)
	}

	for _, o := range orgs {
		om := ms.newOrgMigration(o.ID)
		migrated, err := ms.migrationStore.IsMigrated(ctx, o.ID)
		if err != nil {
			return fmt.Errorf("getting migration status for org %d: %w", o.ID, err)
		}
		if migrated {
			om.log.Info("Org already migrated, skipping")
			continue
		}

		_, err = om.migrateOrg(ctx, false)
		if err != nil {
			return fmt.Errorf("migrate org %d: %w", o.ID, err)
		}

		nestedErrors := om.state.NestedErrors()
		if len(nestedErrors) > 0 {
			return fmt.Errorf("org %d migration contains issues: %q", o.ID, nestedErrors)
		}

		if err := om.writeSilencesFile(); err != nil {
			return fmt.Errorf("write silence file for org %d: %w", o.ID, err)
		}

		err = om.migrationStore.SetOrgMigrationState(ctx, o.ID, om.state)
		if err != nil {
			return err
		}
		err = om.migrationStore.SetMigrated(ctx, o.ID, true)
		if err != nil {
			return fmt.Errorf("setting migration status: %w", err)
		}
	}
	return nil
}

// RevertOrg reverts the migration, deleting all unified alerting resources such as alert rules, alertmanager
// configurations, and silence files for a single organization.
// In addition, it will delete all folders and permissions originally created by this migration.
func (ms *MigrationService) RevertOrg(ctx context.Context, orgID int64) error {
	ms.mtx.Lock()
	defer ms.mtx.Unlock()
	ms.log.Info("Reverting legacy migration for org", "orgID", orgID)
	return ms.store.InTransaction(ctx, func(ctx context.Context) error {
		return ms.migrationStore.RevertOrg(ctx, orgID)
	})
}

// RevertAllOrgs reverts the migration for all orgs, deleting all unified alerting resources such as alert rules, alertmanager configurations, and silence files.
// In addition, it will delete all folders and permissions originally created by this migration.
func (ms *MigrationService) RevertAllOrgs(ctx context.Context) error {
	ms.mtx.Lock()
	defer ms.mtx.Unlock()
	ms.log.Info("Reverting legacy migration for all orgs")
	return ms.store.InTransaction(ctx, func(ctx context.Context) error {
		return ms.migrationStore.RevertAllOrgs(ctx)
	})
}

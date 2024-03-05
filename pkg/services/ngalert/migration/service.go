package migration

import (
	"context"
	"errors"
	"fmt"
	"time"

	alertingModels "github.com/grafana/alerting/models"
	v2 "github.com/prometheus/alertmanager/api/v2"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

// actionName is the unique row-level lock name for serverlock.ServerLockService.
const actionName = "alerting migration"

var ErrUpgradeInProgress = errors.New("upgrade in progress")

type UpgradeService interface {
	Run(ctx context.Context) error
	MigrateAlert(ctx context.Context, orgID int64, dashboardID int64, panelID int64) (definitions.OrgMigrationSummary, error)
	MigrateDashboardAlerts(ctx context.Context, orgID int64, dashboardID int64, skipExisting bool) (definitions.OrgMigrationSummary, error)
	MigrateAllDashboardAlerts(ctx context.Context, orgID int64, skipExisting bool) (definitions.OrgMigrationSummary, error)
	MigrateChannel(ctx context.Context, orgID int64, channelID int64) (definitions.OrgMigrationSummary, error)
	MigrateAllChannels(ctx context.Context, orgID int64, skipExisting bool) (definitions.OrgMigrationSummary, error)
	MigrateOrg(ctx context.Context, orgID int64, skipExisting bool) (definitions.OrgMigrationSummary, error)
	GetOrgMigrationState(ctx context.Context, orgID int64) (*definitions.OrgMigrationState, error)
	RevertOrg(ctx context.Context, orgID int64) error
}

type migrationService struct {
	lock           *serverlock.ServerLockService
	cfg            *setting.Cfg
	features       featuremgmt.FeatureToggles
	log            log.Logger
	store          db.DB
	migrationStore migrationStore.Store

	encryptionService secrets.Service
	silences          *silenceHandler
}

func ProvideService(
	lock *serverlock.ServerLockService,
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	store db.DB,
	migrationStore migrationStore.Store,
	encryptionService secrets.Service,
) (UpgradeService, error) {
	return &migrationService{
		lock:              lock,
		log:               log.New("ngalert.migration"),
		cfg:               cfg,
		features:          features,
		store:             store,
		migrationStore:    migrationStore,
		encryptionService: encryptionService,
		silences: &silenceHandler{
			persistSilences: migrationStore.SetSilences,
		},
	}, nil
}

type operation func(ctx context.Context) (*definitions.OrgMigrationSummary, error)

// tryAndSet attempts to execute the operation and then sets the migrated status to true.
// If another operation is already in progress, ErrUpgradeInProgress will be returned
func (ms *migrationService) tryAndSet(ctx context.Context, orgID int64, op operation) (definitions.OrgMigrationSummary, error) {
	opAndSet := func(ctx context.Context) (*definitions.OrgMigrationSummary, error) {
		s, err := op(ctx)
		if err != nil {
			return nil, err
		}

		err = ms.migrationStore.SetMigrated(ctx, orgID, true)
		if err != nil {
			return nil, fmt.Errorf("setting migration status: %w", err)
		}

		return s, nil
	}
	return ms.try(ctx, opAndSet)
}

// try attempts to execute the operation. If another operation is already in progress, ErrUpgradeInProgress will be returned.
func (ms *migrationService) try(ctx context.Context, op operation) (definitions.OrgMigrationSummary, error) {
	var summary definitions.OrgMigrationSummary
	var errOp error
	errLock := ms.lock.LockExecuteAndRelease(ctx, actionName, time.Minute*10, func(ctx context.Context) {
		errOp = ms.store.InTransaction(ctx, func(ctx context.Context) error {
			s, err := op(ctx)
			if err != nil {
				return err
			}
			if s != nil {
				summary.Add(*s)
			}
			return nil
		})
	})
	if errLock != nil {
		return definitions.OrgMigrationSummary{}, ErrUpgradeInProgress
	}
	if errOp != nil {
		return definitions.OrgMigrationSummary{}, errOp
	}

	return summary, nil
}

// MigrateChannel migrates a single legacy notification channel to a unified alerting contact point.
func (ms *migrationService) MigrateChannel(ctx context.Context, orgID int64, channelID int64) (definitions.OrgMigrationSummary, error) {
	return ms.tryAndSet(ctx, orgID, func(ctx context.Context) (*definitions.OrgMigrationSummary, error) {
		summary := definitions.OrgMigrationSummary{}
		om := ms.newOrgMigration(orgID)
		l := om.log.FromContext(ctx)
		oldState, err := om.migrationStore.GetOrgMigrationState(ctx, orgID)
		if err != nil {
			return nil, fmt.Errorf("get org migration state: %w", err)
		}

		channel, err := om.migrationStore.GetNotificationChannel(ctx, migrationStore.GetNotificationChannelQuery{OrgID: orgID, ID: channelID})
		if err != nil && !errors.Is(err, migrationStore.ErrNotFound) {
			return nil, fmt.Errorf("get notification channel: %w", err)
		}

		var delta StateDelta
		if err != nil && errors.Is(err, migrationStore.ErrNotFound) {
			// Notification channel no longer exists, delete this record from the state as well as delete any contacts points and routes.
			l.Debug("Notification channel no longer exists", "channelId", channelID)
			summary.Removed = true
			pair, ok := oldState.MigratedChannels[channelID]
			if !ok {
				pair = &migrationStore.ContactPair{LegacyID: channelID}
			}
			delta = StateDelta{
				ChannelsToDelete: []*migrationStore.ContactPair{pair},
			}
		} else {
			pairs, err := om.migrateChannels([]*legacymodels.AlertNotification{channel}, l)
			if err != nil {
				return nil, err
			}

			delta = createDelta(oldState, nil, pairs, false)
		}

		s, err := ms.newSync(orgID).syncDelta(ctx, oldState, delta)
		if err != nil {
			return nil, err
		}

		err = ms.migrationStore.SetOrgMigrationState(ctx, orgID, oldState)
		if err != nil {
			return nil, err
		}

		summary.Add(s)
		return &summary, nil
	})
}

// MigrateAllChannels migrates all legacy notification channel to unified alerting contact points.
func (ms *migrationService) MigrateAllChannels(ctx context.Context, orgID int64, skipExisting bool) (definitions.OrgMigrationSummary, error) {
	return ms.tryAndSet(ctx, orgID, func(ctx context.Context) (*definitions.OrgMigrationSummary, error) {
		summary := definitions.OrgMigrationSummary{}
		om := ms.newOrgMigration(orgID)
		pairs, err := om.migrateOrgChannels(ctx)
		if err != nil {
			return nil, err
		}

		s, err := ms.newSync(orgID).syncAndSaveState(ctx, nil, pairs, skipExisting)
		if err != nil {
			return nil, err
		}

		summary.Add(s)
		return &summary, nil
	})
}

// MigrateAlert migrates a single dashboard alert from legacy alerting to unified alerting.
func (ms *migrationService) MigrateAlert(ctx context.Context, orgID int64, dashboardID int64, panelID int64) (definitions.OrgMigrationSummary, error) {
	return ms.tryAndSet(ctx, orgID, func(ctx context.Context) (*definitions.OrgMigrationSummary, error) {
		summary := definitions.OrgMigrationSummary{}
		om := ms.newOrgMigration(orgID)
		oldState, err := om.migrationStore.GetOrgMigrationState(ctx, orgID)
		if err != nil {
			return nil, fmt.Errorf("get org migration state: %w", err)
		}

		delta := StateDelta{}
		du, ok := oldState.MigratedDashboards[dashboardID]
		if ok {
			existingPair := &migmodels.AlertPair{LegacyRule: &legacymodels.Alert{PanelID: panelID, DashboardID: dashboardID}}
			if pair, ok := du.MigratedAlerts[panelID]; ok {
				existingPair.Rule = &models.AlertRule{UID: pair.NewRuleUID}
			}
			delta.AlertsToDelete = []*migmodels.AlertPair{existingPair}
		}

		alert, err := ms.migrationStore.GetDashboardAlert(ctx, orgID, dashboardID, panelID)
		if err != nil && !errors.Is(err, migrationStore.ErrNotFound) {
			return nil, fmt.Errorf("get alert: %w", err)
		}

		if err != nil && errors.Is(err, migrationStore.ErrNotFound) {
			// Legacy alert no longer exists, delete this record from the state.
			om.log.FromContext(ctx).Debug("Alert no longer exists", "dashboardId", dashboardID, "panelId", panelID)
			summary.Removed = true
		} else {
			newDu := om.migrateDashboard(ctx, dashboardID, []*legacymodels.Alert{alert})
			if _, ok := oldState.MigratedDashboards[dashboardID]; !ok {
				delta.DashboardsToAdd = []*migmodels.DashboardUpgrade{newDu}
			} else {
				// Replace only this alert on the dashboard.
				for _, pair := range newDu.MigratedAlerts {
					delta.AlertsToAdd = append(delta.AlertsToAdd, pair)
				}
			}
		}

		s, err := ms.newSync(orgID).syncDelta(ctx, oldState, delta)
		if err != nil {
			return nil, err
		}

		// We don't create new folders here, so no need to upgrade summary.CreatedFolders.
		err = ms.migrationStore.SetOrgMigrationState(ctx, orgID, oldState)
		if err != nil {
			return nil, err
		}

		summary.Add(s)
		return &summary, nil
	})
}

// MigrateDashboardAlerts migrates all legacy dashboard alerts from a single dashboard to unified alerting.
func (ms *migrationService) MigrateDashboardAlerts(ctx context.Context, orgID int64, dashboardID int64, skipExisting bool) (definitions.OrgMigrationSummary, error) {
	return ms.tryAndSet(ctx, orgID, func(ctx context.Context) (*definitions.OrgMigrationSummary, error) {
		summary := definitions.OrgMigrationSummary{}
		om := ms.newOrgMigration(orgID)
		alerts, err := ms.migrationStore.GetDashboardAlerts(ctx, orgID, dashboardID)
		if err != nil {
			return nil, fmt.Errorf("get alerts: %w", err)
		}

		du := om.migrateDashboard(ctx, dashboardID, alerts)
		s, err := ms.newSync(orgID).syncAndSaveState(ctx, []*migmodels.DashboardUpgrade{du}, nil, skipExisting)
		if err != nil {
			return nil, err
		}

		summary.Add(s)
		return &summary, nil
	})
}

// MigrateAllDashboardAlerts migrates all legacy alerts to unified alerting contact points.
func (ms *migrationService) MigrateAllDashboardAlerts(ctx context.Context, orgID int64, skipExisting bool) (definitions.OrgMigrationSummary, error) {
	return ms.tryAndSet(ctx, orgID, func(ctx context.Context) (*definitions.OrgMigrationSummary, error) {
		summary := definitions.OrgMigrationSummary{}
		om := ms.newOrgMigration(orgID)
		dashboardUpgrades, err := om.migrateOrgAlerts(ctx)
		if err != nil {
			return nil, err
		}

		s, err := ms.newSync(orgID).syncAndSaveState(ctx, dashboardUpgrades, nil, skipExisting)
		if err != nil {
			return nil, err
		}

		summary.Add(s)
		return &summary, nil
	})
}

// MigrateOrg executes the migration for a single org.
func (ms *migrationService) MigrateOrg(ctx context.Context, orgID int64, skipExisting bool) (definitions.OrgMigrationSummary, error) {
	return ms.tryAndSet(ctx, orgID, func(ctx context.Context) (*definitions.OrgMigrationSummary, error) {
		summary := definitions.OrgMigrationSummary{}
		ms.log.FromContext(ctx).Info("Starting legacy upgrade for org", "orgId", orgID, "skipExisting", skipExisting)
		om := ms.newOrgMigration(orgID)
		dashboardUpgrades, pairs, err := om.migrateOrg(ctx)
		if err != nil {
			return nil, err
		}

		s, err := ms.newSync(orgID).syncAndSaveState(ctx, dashboardUpgrades, pairs, skipExisting)
		if err != nil {
			return nil, err
		}

		summary.Add(s)
		return &summary, nil
	})
}

// GetOrgMigrationState returns the current migration state for an org. This is a potentially expensive operation as it
// requires re-hydrating the entire migration state from the database against all current alerting resources.
func (ms *migrationService) GetOrgMigrationState(ctx context.Context, orgID int64) (*definitions.OrgMigrationState, error) {
	dState, err := ms.migrationStore.GetOrgMigrationState(ctx, orgID)
	if err != nil {
		return nil, err
	}

	cfg, err := ms.migrationStore.GetAlertmanagerConfig(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("get alertmanager config: %w", err)
	}
	amConfig := migmodels.FromPostableUserConfig(cfg)

	// Hydrate the slim database model.
	migratedChannels, err := ms.fromContactPairs(ctx, orgID, dState.MigratedChannels, amConfig)
	if err != nil {
		return nil, fmt.Errorf("rehydrate channels: %w", err)
	}

	migratedDashboards, err := ms.fromDashboardUpgrades(ctx, orgID, dState.MigratedDashboards, amConfig)
	if err != nil {
		return nil, fmt.Errorf("rehydrate alerts: %w", err)
	}

	return &definitions.OrgMigrationState{
		OrgID:              dState.OrgID,
		MigratedDashboards: migratedDashboards,
		MigratedChannels:   migratedChannels,
	}, nil
}

// ErrSuccessRollback is returned when a dry-run succeeded and the changes were rolled back.
var ErrSuccessRollback = errors.New("dry-run succeeded, rolling back")

// Run starts the migration to transition between legacy alerting and unified alerting based on the current and desired
// alerting type as determined by the kvstore and configuration, respectively.
func (ms *migrationService) Run(ctx context.Context) error {
	var errMigration error
	errLock := ms.lock.LockExecuteAndRelease(ctx, actionName, time.Minute*10, func(ctx context.Context) {
		l := ms.log.FromContext(ctx)
		l.Info("Starting")
		currentType, err := ms.migrationStore.GetCurrentAlertingType(ctx)
		if err != nil {
			errMigration = fmt.Errorf("getting migration status: %w", err)
			return
		}

		errMigration = ms.applyTransition(ctx, ms.newTransition(currentType))
	})
	if errLock != nil {
		ms.log.FromContext(ctx).Warn("Server lock for alerting migration already exists")
		return nil
	}
	if errMigration != nil {
		return fmt.Errorf("migration failed: %w", errMigration)
	}
	return nil
}

// newTransition creates a transition based on the current alerting type and the current configuration.
func (ms *migrationService) newTransition(currentType migrationStore.AlertingType) transition {
	desiredType := migrationStore.Legacy
	if ms.cfg.UnifiedAlerting.IsEnabled() {
		desiredType = migrationStore.UnifiedAlerting
	}
	return transition{
		CurrentType:      currentType,
		DesiredType:      desiredType,
		CleanOnDowngrade: ms.cfg.ForceMigration,
		CleanOnUpgrade:   ms.cfg.UnifiedAlerting.Upgrade.CleanUpgrade,
		// In 10.4.0+, even if legacy alerting is enabled and the user is not intending to update, we want to "test the waters".
		// This is intended to surface any potential issues that would exist if the upgrade would be run right now but without
		// risk of failing startup.
		DryrunUpgrade: ms.features.IsEnabledGlobally(featuremgmt.FlagAlertingUpgradeDryrunOnStart) && currentType == migrationStore.Legacy && desiredType == migrationStore.Legacy,
	}
}

// transition represents a migration from one alerting type to another.
type transition struct {
	CurrentType      migrationStore.AlertingType
	DesiredType      migrationStore.AlertingType
	CleanOnDowngrade bool
	CleanOnUpgrade   bool
	DryrunUpgrade    bool
}

// isNoChange returns true if the migration is a no-op.
func (t transition) isNoChange() bool {
	return t.CurrentType == t.DesiredType && !t.DryrunUpgrade
}

// isUpgrading returns true if the migration is an upgrade from legacy alerting to unified alerting.
func (t transition) isUpgrading() bool {
	return (t.CurrentType == migrationStore.Legacy && t.DesiredType == migrationStore.UnifiedAlerting) || t.DryrunUpgrade
}

// isDowngrading returns true if the migration is a downgrade from unified alerting to legacy alerting.
func (t transition) isDowngrading() bool {
	return t.CurrentType == migrationStore.UnifiedAlerting && t.DesiredType == migrationStore.Legacy
}

// shouldClean returns true if the migration should delete all unified alerting data.
func (t transition) shouldClean() bool {
	return t.isDowngrading() && t.CleanOnDowngrade || t.isUpgrading() && t.CleanOnUpgrade
}

// applyTransition applies the transition to the database.
// If the transition is a no-op, nothing will be done.
// If the transition is a downgrade and CleanOnDowngrade is false, nothing will be done.
// If the transition is a downgrade and CleanOnDowngrade is true, all unified alerting data will be deleted.
// If the transition is an upgrade and CleanOnUpgrade is false, all orgs will be migrated.
// If the transition is an upgrade and CleanOnUpgrade is true, all unified alerting data will be deleted and then all orgs will be migrated.
func (ms *migrationService) applyTransition(ctx context.Context, t transition) error {
	if t.DryrunUpgrade {
		ctx = log.WithContextualAttributes(ctx, []any{"dryrun", "true"})
	}

	err := ms.store.InTransaction(ctx, func(ctx context.Context) error {
		l := ms.log.FromContext(ctx)
		if t.isNoChange() {
			l.Debug("No change in alerting type")
			return nil
		}

		if t.DryrunUpgrade {
			l.Info(fmt.Sprintf("Dry-running upgrade. To deactivate on-start dry-run, disable the feature flag '%s'", featuremgmt.FlagAlertingUpgradeDryrunOnStart), "cleanOnUpgrade", t.CleanOnUpgrade)
		} else {
			l.Info("Applying transition", "currentType", t.CurrentType, "desiredType", t.DesiredType, "cleanOnDowngrade", t.CleanOnDowngrade, "cleanOnUpgrade", t.CleanOnUpgrade)
		}

		if t.shouldClean() {
			l.Info("Cleaning up unified alerting data")
			if err := ms.migrationStore.RevertAllOrgs(ctx); err != nil {
				return fmt.Errorf("cleaning up unified alerting data: %w", err)
			}
			l.Info("Unified alerting data deleted")
		}

		if t.isUpgrading() {
			if err := ms.migrateAllOrgs(ctx); err != nil {
				return fmt.Errorf("executing migration: %w", err)
			}
		}

		if err := ms.migrationStore.SetCurrentAlertingType(ctx, t.DesiredType); err != nil {
			return fmt.Errorf("setting migration status: %w", err)
		}

		if t.DryrunUpgrade {
			// Ensure we rollback the changes made during the dry-run.
			return ErrSuccessRollback
		}

		l.Info("Completed alerting migration")
		return nil
	})
	if t.DryrunUpgrade {
		if errors.Is(err, ErrSuccessRollback) {
			ms.log.FromContext(ctx).Info("Dry-run upgrade succeeded. No changes were made. Current legacy alerting setup is ready to upgrade.")
		} else {
			ms.log.FromContext(ctx).Warn("Dry-run upgrade failed. No changes were made. Current legacy alerting setup will fail to upgrade, issues must be fixed before upgrading Grafana to v11 as legacy alerting will be removed. See https://grafana.com/docs/grafana/v10.4/alerting/set-up/migrating-alerts/ for more details.", "err", err)
		}
		// Dry should never error.
		return nil
	}

	return err
}

// migrateAllOrgs executes the migration for all orgs.
func (ms *migrationService) migrateAllOrgs(ctx context.Context) error {
	orgs, err := ms.migrationStore.GetAllOrgs(ctx)
	if err != nil {
		return fmt.Errorf("get orgs: %w", err)
	}

	for _, o := range orgs {
		om := ms.newOrgMigration(o.ID)
		l := om.log.FromContext(ctx)
		migrated, err := ms.migrationStore.IsMigrated(ctx, o.ID)
		if err != nil {
			return fmt.Errorf("getting migration status for org %d: %w", o.ID, err)
		}
		if migrated {
			l.Info("Org already migrated, skipping")
			continue
		}

		dashboardUpgrades, contactPairs, err := om.migrateOrg(ctx)
		if err != nil {
			return fmt.Errorf("migrate org %d: %w", o.ID, err)
		}

		// Check for errors, if any exist log and fail the migration.
		errs := migmodels.ExtractErrors(dashboardUpgrades, contactPairs)
		var migrationErr error
		for _, e := range errs {
			// Skip certain errors as historically they are not fatal to the migration. We can revisit these if necessary.
			if errors.Is(e, ErrDiscontinued) {
				// Discontinued notification type.
				continue
			}
			if errors.Is(e, ErrOrphanedAlert) {
				// Orphaned alerts.
				continue
			}
			migrationErr = errors.Join(migrationErr, e)
		}
		if migrationErr != nil {
			return fmt.Errorf("migrate org %d: %w", o.ID, migrationErr)
		}

		_, err = ms.newSync(o.ID).syncAndSaveState(ctx, dashboardUpgrades, contactPairs, false)
		if err != nil {
			return err
		}

		err = ms.silences.createSilences(ctx, o.ID, l)
		if err != nil {
			return fmt.Errorf("create silences for org %d: %w", o.ID, err)
		}

		err = ms.migrationStore.SetMigrated(ctx, o.ID, true)
		if err != nil {
			return fmt.Errorf("setting migration status: %w", err)
		}
	}
	return nil
}

// RevertOrg reverts the migration, deleting all unified alerting resources such as alert rules, alertmanager
// configurations, and silence files for a single organization.
// In addition, it will delete all folders and permissions originally created by this migration.
func (ms *migrationService) RevertOrg(ctx context.Context, orgID int64) error {
	ms.log.FromContext(ctx).Info("Reverting legacy upgrade for org", "orgId", orgID)
	_, err := ms.try(ctx, func(ctx context.Context) (*definitions.OrgMigrationSummary, error) {
		return nil, ms.migrationStore.RevertOrg(ctx, orgID)
	})
	return err
}

// RevertAllOrgs reverts the migration for all orgs, deleting all unified alerting resources such as alert rules, alertmanager configurations, and silence files.
// In addition, it will delete all folders and permissions originally created by this migration.
func (ms *migrationService) RevertAllOrgs(ctx context.Context) error {
	ms.log.FromContext(ctx).Info("Reverting legacy upgrade for all orgs")
	_, err := ms.try(ctx, func(ctx context.Context) (*definitions.OrgMigrationSummary, error) {
		return nil, ms.migrationStore.RevertAllOrgs(ctx)
	})
	return err
}

// fromDashboardUpgrades converts DashboardUpgrades to their api representation. This requires rehydrating information
// from the database for the current state of dashboards, alerts, and rules.
func (ms *migrationService) fromDashboardUpgrades(ctx context.Context, orgID int64, migratedDashboards map[int64]*migrationStore.DashboardUpgrade, amConfig *migmodels.Alertmanager) ([]*definitions.DashboardUpgrade, error) {
	// We preload information in bulk for performance reasons.
	alertRules, err := ms.migrationStore.GetSlimAlertRules(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("get all alert rules: %w", err)
	}

	dashboardAlerts, err := ms.migrationStore.GetSlimOrgDashboardAlerts(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("get dashboard alerts: %w", err)
	}

	dashIDInfo, err := ms.migrationStore.GetSlimDashboards(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("get dashboards: %w", err)
	}
	dashUIDInfo := make(map[string]migrationStore.SlimDashboard, len(dashIDInfo))
	for _, info := range dashIDInfo {
		dashUIDInfo[info.UID] = info
	}

	res := make([]*definitions.DashboardUpgrade, 0, len(dashboardAlerts))
	existingDashboards := make(map[int64]struct{})
	for dashboardID, alerts := range dashboardAlerts {
		existingDashboards[dashboardID] = struct{}{}
		mDu := &definitions.DashboardUpgrade{
			MigratedAlerts: make([]*definitions.AlertPair, 0),
			DashboardID:    dashboardID,
		}

		dashInfo, ok := dashIDInfo[dashboardID]
		if ok {
			folderInfo := dashIDInfo[dashInfo.FolderID]
			mDu.DashboardUID = dashInfo.UID
			mDu.DashboardName = dashInfo.Title
			mDu.FolderUID = folderInfo.UID
			mDu.FolderName = folderInfo.Title
			mDu.Provisioned = dashInfo.Provisioned
		}

		du, ok := migratedDashboards[dashboardID]
		if !ok {
			mDu.Error = "dashboard not upgraded"
			// Empty dashboard upgrade, to simplify logic below.
			du = &migrationStore.DashboardUpgrade{
				DashboardID:    dashboardID,
				MigratedAlerts: make(map[int64]*migrationStore.AlertPair),
			}
		}
		mDu.Warning = du.Warning

		if du.AlertFolderUID != "" {
			newFolderInfo := dashUIDInfo[du.AlertFolderUID]
			mDu.NewFolderUID = du.AlertFolderUID
			mDu.NewFolderName = newFolderInfo.Title
		}

		existingAlerts := make(map[int64]struct{})
		for _, a := range alerts {
			existingAlerts[a.ID] = struct{}{}
			pair := &definitions.AlertPair{
				LegacyAlert: fromSlimAlert(a),
				Error:       "alert not upgraded",
			}

			if p, ok := du.MigratedAlerts[a.PanelID]; ok {
				pair.Error = p.Error
				if p.NewRuleUID != "" {
					if rule, ok := alertRules[p.NewRuleUID]; ok {
						var sendTo = make([]string, 0)
						for _, m := range amConfig.Match(extractLabels(rule, mDu.NewFolderName)) {
							sendTo = append(sendTo, m.RouteOpts.Receiver)
						}
						pair.AlertRule = fromSlimAlertRule(rule, sendTo)
					} else {
						// We could potentially set an error here, but it's not really an error. It just means that the
						// user deleted the migrated rule after the migration. This could just as easily be intentional.
						ms.log.FromContext(ctx).Debug("Could not find rule for migrated alert", "alertId", a.ID, "ruleUid", p.NewRuleUID)
					}
				}
			}

			mDu.MigratedAlerts = append(mDu.MigratedAlerts, pair)
		}

		// Now we check the inverse, for alerts that were migrated but no longer exist.
		for _, p := range du.MigratedAlerts {
			if _, ok := existingAlerts[p.LegacyID]; !ok {
				pair := &definitions.AlertPair{
					LegacyAlert: &definitions.LegacyAlert{ID: p.LegacyID, PanelID: p.PanelID, DashboardID: du.DashboardID},
					Error:       "alert no longer exists",
				}
				if p.NewRuleUID != "" {
					if rule, ok := alertRules[p.NewRuleUID]; ok {
						var sendTo = make([]string, 0)
						for _, m := range amConfig.Match(extractLabels(rule, mDu.NewFolderName)) {
							sendTo = append(sendTo, m.RouteOpts.Receiver)
						}
						pair.AlertRule = fromSlimAlertRule(rule, sendTo)
					}
				}
				mDu.MigratedAlerts = append(mDu.MigratedAlerts, pair)
			}
		}

		res = append(res, mDu)
	}

	// Now we check the inverse, for dashboards that were migrated but no longer exist.
	for dashboardId, du := range migratedDashboards {
		if _, ok := existingDashboards[dashboardId]; !ok {
			mDu := &definitions.DashboardUpgrade{
				MigratedAlerts: make([]*definitions.AlertPair, 0),
				DashboardID:    dashboardId,
				Error:          "dashboard no longer exists",
				Warning:        du.Warning,
			}

			if du.AlertFolderUID != "" {
				newFolderInfo := dashUIDInfo[du.AlertFolderUID]
				mDu.NewFolderUID = du.AlertFolderUID
				mDu.NewFolderName = newFolderInfo.Title
			}

			for _, p := range du.MigratedAlerts {
				pair := &definitions.AlertPair{
					LegacyAlert: &definitions.LegacyAlert{ID: p.LegacyID, PanelID: p.PanelID, DashboardID: du.DashboardID},
					Error:       "dashboard no longer exists",
				}
				if p.NewRuleUID != "" {
					if rule, ok := alertRules[p.NewRuleUID]; ok {
						var sendTo = make([]string, 0)
						for _, m := range amConfig.Match(extractLabels(rule, mDu.NewFolderName)) {
							sendTo = append(sendTo, m.RouteOpts.Receiver)
						}
						pair.AlertRule = fromSlimAlertRule(rule, sendTo)
					}
				}
				mDu.MigratedAlerts = append(mDu.MigratedAlerts, pair)
			}

			res = append(res, mDu)
		}
	}

	return res, nil
}

// fromContactPairs converts ContactPairs to their api representation. This requires rehydrating information
// from the database for the current state of legacy channels and alertmanager configurations.
func (ms *migrationService) fromContactPairs(ctx context.Context, orgID int64, migratedChannels map[int64]*migrationStore.ContactPair, amConfig *migmodels.Alertmanager) ([]*definitions.ContactPair, error) {
	channels, err := ms.migrationStore.GetNotificationChannels(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("get notification channels: %w", err)
	}

	res := make([]*definitions.ContactPair, 0, len(channels))
	existingChannels := make(map[int64]struct{})
	for _, channel := range channels {
		existingChannels[channel.ID] = struct{}{}
		pair := &definitions.ContactPair{
			LegacyChannel: fromAlertNotification(channel),
			Error:         "channel not upgraded",
		}

		if p, ok := migratedChannels[channel.ID]; ok {
			if p.NewReceiverUID != "" {
				if recv, ok := amConfig.GetReceiver(p.NewReceiverUID); ok {
					if route, ok := amConfig.GetLegacyRoute(recv.Name); ok {
						pair.ContactPointUpgrade = fromContactPointUpgrade(recv, route)
					}
				}
			}
			pair.Error = p.Error
		}

		res = append(res, pair)
	}

	// Now we check the inverse, for channels that were migrated but no longer exist.
	for _, p := range migratedChannels {
		if _, ok := existingChannels[p.LegacyID]; !ok {
			pair := &definitions.ContactPair{
				LegacyChannel: &definitions.LegacyChannel{ID: p.LegacyID},
				Error:         "channel no longer exists",
			}
			if p.NewReceiverUID != "" {
				if recv, ok := amConfig.GetReceiver(p.NewReceiverUID); ok {
					if route, ok := amConfig.GetLegacyRoute(recv.Name); ok {
						pair.ContactPointUpgrade = fromContactPointUpgrade(recv, route)
					}
				}
			}
			res = append(res, pair)
		}
	}

	return res, nil
}

// fromSlimAlert converts a slim alert to the api representation.
func fromSlimAlert(alert *migrationStore.SlimAlert) *definitions.LegacyAlert {
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

// fromSlimAlertRule converts a slim alert rule to the api representation.
func fromSlimAlertRule(rule *migrationStore.SlimAlertRule, sendsTo []string) *definitions.AlertRuleUpgrade {
	if rule == nil {
		return nil
	}
	return &definitions.AlertRuleUpgrade{
		UID:     rule.UID,
		Title:   rule.Title,
		SendsTo: sendsTo,
	}
}

// fromAlertNotification converts an alert notification to the api representation.
func fromAlertNotification(channel *legacymodels.AlertNotification) *definitions.LegacyChannel {
	if channel == nil {
		return nil
	}
	return &definitions.LegacyChannel{
		ID:   channel.ID,
		Name: channel.Name,
		Type: channel.Type,
	}
}

// fromContactPointUpgrade converts a postable grafana receiver and route to the api representation.
func fromContactPointUpgrade(recv *definitions.PostableGrafanaReceiver, route *definitions.Route) *definitions.ContactPointUpgrade {
	if recv == nil || len(route.ObjectMatchers) == 0 {
		return nil
	}
	return &definitions.ContactPointUpgrade{
		Name:          recv.Name,
		Type:          recv.Type,
		RouteMatchers: route.ObjectMatchers,
	}
}

func extractLabels(rule *migrationStore.SlimAlertRule, folderName string) model.LabelSet {
	mls := v2.APILabelSetToModelLabelSet(rule.Labels)

	mls[alertingModels.NamespaceUIDLabel] = model.LabelValue(rule.NamespaceUID)
	mls[model.AlertNameLabel] = model.LabelValue(rule.Title)
	mls[alertingModels.RuleUIDLabel] = model.LabelValue(rule.UID)
	mls[models.FolderTitleLabel] = model.LabelValue(folderName)

	return mls
}

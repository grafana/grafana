package migration

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

// actionName is the unique row-level lock name for serverlock.ServerLockService.
const actionName = "alerting migration"

//nolint:stylecheck
var ForceMigrationError = fmt.Errorf("Grafana has already been migrated to Unified Alerting. Any alert rules created while using Unified Alerting will be deleted by rolling back. Set force_migration=true in your grafana.ini and restart Grafana to roll back and delete Unified Alerting configuration data.")

type UpgradeService interface {
	Run(ctx context.Context) error
}

type migrationService struct {
	lock           *serverlock.ServerLockService
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
) (UpgradeService, error) {
	return &migrationService{
		lock:              lock,
		log:               log.New("ngalert.migration"),
		cfg:               cfg,
		store:             store,
		migrationStore:    migrationStore,
		encryptionService: encryptionService,
	}, nil
}

// Run starts the migration to transition between legacy alerting and unified alerting based on the current and desired
// alerting type as determined by the kvstore and configuration, respectively.
func (ms *migrationService) Run(ctx context.Context) error {
	var errMigration error
	errLock := ms.lock.LockExecuteAndRelease(ctx, actionName, time.Minute*10, func(ctx context.Context) {
		ms.log.Info("Starting")
		errMigration = ms.store.InTransaction(ctx, func(ctx context.Context) error {
			currentType, err := ms.migrationStore.GetCurrentAlertingType(ctx)
			if err != nil {
				return fmt.Errorf("getting migration status: %w", err)
			}
			return ms.applyTransition(ctx, newTransition(currentType, ms.cfg))
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

// newTransition creates a transition based on the current alerting type and the current configuration.
func newTransition(currentType migrationStore.AlertingType, cfg *setting.Cfg) transition {
	desiredType := migrationStore.Legacy
	if cfg.UnifiedAlerting.IsEnabled() {
		desiredType = migrationStore.UnifiedAlerting
	}
	return transition{
		CurrentType:      currentType,
		DesiredType:      desiredType,
		CleanOnDowngrade: cfg.ForceMigration,
	}
}

// transition represents a migration from one alerting type to another.
type transition struct {
	CurrentType      migrationStore.AlertingType
	DesiredType      migrationStore.AlertingType
	CleanOnDowngrade bool
}

// isNoChange returns true if the migration is a no-op.
func (t transition) isNoChange() bool {
	return t.CurrentType == t.DesiredType
}

// isUpgrading returns true if the migration is an upgrade from legacy alerting to unified alerting.
func (t transition) isUpgrading() bool {
	return t.CurrentType == migrationStore.Legacy && t.DesiredType == migrationStore.UnifiedAlerting
}

// isDowngrading returns true if the migration is a downgrade from unified alerting to legacy alerting.
func (t transition) isDowngrading() bool {
	return t.CurrentType == migrationStore.UnifiedAlerting && t.DesiredType == migrationStore.Legacy
}

// shouldClean returns true if the migration should delete all unified alerting data.
func (t transition) shouldClean() bool {
	return t.isDowngrading() && t.CleanOnDowngrade
}

// applyTransition applies the transition to the database.
// If the transition is a no-op, nothing will be done.
// If the transition is a downgrade and CleanOnDowngrade is true, all unified alerting data will be deleted.
// If the transition is a downgrade and CleanOnDowngrade is false, an error will be returned.
// If the transition is an upgrade, all orgs will be migrated.
func (ms *migrationService) applyTransition(ctx context.Context, t transition) error {
	l := ms.log.New(
		"CurrentType", t.CurrentType,
		"DesiredType", t.DesiredType,
		"CleanOnDowngrade", t.CleanOnDowngrade,
	)
	if t.isNoChange() {
		l.Info("Migration already complete")
		return nil
	}

	// Safeguard to prevent accidental data loss when reverting from UA to LA.
	if t.isDowngrading() && !ms.cfg.ForceMigration {
		return ForceMigrationError
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

	l.Info("Completed legacy migration")
	return nil
}

// migrateAllOrgs executes the migration for all orgs.
func (ms *migrationService) migrateAllOrgs(ctx context.Context) error {
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

		if err := om.migrateOrg(ctx); err != nil {
			return fmt.Errorf("migrate org %d: %w", o.ID, err)
		}

		err = om.migrationStore.SetOrgMigrationState(ctx, o.ID, om.state)
		if err != nil {
			return fmt.Errorf("set org migration state: %w", err)
		}

		err = ms.migrationStore.SetMigrated(ctx, o.ID, true)
		if err != nil {
			return fmt.Errorf("setting migration status: %w", err)
		}
	}
	return nil
}

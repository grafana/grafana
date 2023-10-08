package migration

import (
	"context"
	"fmt"
	"sync"
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

// IsDisabled returns true if the cfg is nil.
func (ms *MigrationService) IsDisabled() bool {
	return ms.cfg == nil
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

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

type MigrationService struct {
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

// Run starts the migration. This will either migrate from legacy alerting to unified alerting or revert the migration.
// If the migration status in the kvstore is not set and unified alerting is enabled, the migration will be executed.
// If the migration status in the kvstore is set and both unified alerting is disabled and ForceMigration is set to true, the migration will be reverted.
func (ms *MigrationService) Run(ctx context.Context) error {
	var errMigration error
	errLock := ms.lock.LockExecuteAndRelease(ctx, actionName, time.Minute*10, func(context.Context) {
		ms.log.Info("Starting")
		errMigration = ms.store.InTransaction(ctx, func(ctx context.Context) error {
			migrated, err := ms.migrationStore.IsMigrated(ctx)
			if err != nil {
				return fmt.Errorf("getting migration status: %w", err)
			}
			if migrated == ms.cfg.UnifiedAlerting.IsEnabled() {
				// Nothing to do.
				ms.log.Info("No migrations to run")
				return nil
			}

			if migrated {
				// If legacy alerting is also disabled, there is nothing to do
				if setting.AlertingEnabled != nil && !*setting.AlertingEnabled {
					return nil
				}

				// Safeguard to prevent data loss when reverting from UA to LA.
				if !ms.cfg.ForceMigration {
					return ForceMigrationError
				}

				// Revert migration
				ms.log.Info("Reverting legacy migration")
				err := ms.migrationStore.RevertAllOrgs(ctx)
				if err != nil {
					return fmt.Errorf("reverting migration: %w", err)
				}
				ms.log.Info("Legacy migration reverted")
				return nil
			}

			ms.log.Info("Starting legacy migration")
			err = ms.migrateAllOrgs(ctx)
			if err != nil {
				return fmt.Errorf("executing migration: %w", err)
			}

			err = ms.migrationStore.SetMigrated(ctx, true)
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
		if err := om.migrateOrg(ctx); err != nil {
			return fmt.Errorf("migrate org %d: %w", o.ID, err)
		}

		err = om.migrationStore.SetOrgMigrationState(ctx, o.ID, om.state)
		if err != nil {
			return err
		}
	}
	return nil
}

package migration

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

// KVNamespace is the kvstore namespace used for the migration status.
const KVNamespace = "ngalert.migration"

// migratedKey is the kvstore key used for the migration status.
const migratedKey = "migrated"

// actionName is the unique row-level lock name for serverlock.ServerLockService.
const actionName = "alerting migration"

//nolint:stylecheck
var ForceMigrationError = fmt.Errorf("Grafana has already been migrated to Unified Alerting. Any alert rules created while using Unified Alerting will be deleted by rolling back. Set force_migration=true in your grafana.ini and restart Grafana to roll back and delete Unified Alerting configuration data.")

type MigrationService struct {
	lock              *serverlock.ServerLockService
	store             db.DB
	cfg               *setting.Cfg
	log               log.Logger
	kv                *kvstore.NamespacedKVStore
	ruleStore         RuleStore
	alertingStore     AlertingStore
	encryptionService secrets.Service
	dashboardService  dashboards.DashboardService
	folderService     folder.Service
	dataSourceCache   datasources.CacheService
}

func ProvideService(
	lock *serverlock.ServerLockService,
	cfg *setting.Cfg,
	sqlStore db.DB,
	kv kvstore.KVStore,
	ruleStore *store.DBstore,
	encryptionService secrets.Service,
	dashboardService dashboards.DashboardService,
	folderService folder.Service,
	dataSourceCache datasources.CacheService,
) (*MigrationService, error) {
	return &MigrationService{
		lock:              lock,
		log:               log.New("ngalert.migration"),
		cfg:               cfg,
		store:             sqlStore,
		kv:                kvstore.WithNamespace(kv, 0, KVNamespace),
		ruleStore:         ruleStore,
		alertingStore:     ruleStore,
		encryptionService: encryptionService,
		dashboardService:  dashboardService,
		folderService:     folderService,
		dataSourceCache:   dataSourceCache,
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
			migrated, err := ms.GetMigrated(ctx)
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
				err := ms.Revert(ctx)
				if err != nil {
					return fmt.Errorf("reverting migration: %w", err)
				}
				ms.log.Info("Legacy migration reverted")
				return nil
			}

			ms.log.Info("Starting legacy migration")
			mg := newMigration(ms.log,
				ms.cfg,
				ms.store,
				ms.ruleStore,
				ms.alertingStore,
				ms.store.GetDialect(),
				ms.encryptionService,
				ms.dashboardService,
				ms.folderService,
				ms.dataSourceCache,
			)

			err = mg.Exec(ctx)
			if err != nil {
				return fmt.Errorf("executing migration: %w", err)
			}

			err = ms.SetMigrated(ctx, true)
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

// GetMigrated returns the migration status from the kvstore.
func (ms *MigrationService) GetMigrated(ctx context.Context) (bool, error) {
	content, exists, err := ms.kv.Get(ctx, migratedKey)
	if err != nil {
		return false, err
	}

	if !exists {
		return false, nil
	}

	return strconv.ParseBool(content)
}

// SetMigrated sets the migration status in the kvstore.
func (ms *MigrationService) SetMigrated(ctx context.Context, migrated bool) error {
	return ms.kv.Set(ctx, migratedKey, strconv.FormatBool(migrated))
}

// Revert reverts the migration, deleting all unified alerting resources such as alert rules, alertmanager configurations, and silence files.
// In addition, it will delete all folder and permissions originally created by this migration, these are marked by the FOLDER_CREATED_BY constant.
func (ms *MigrationService) Revert(ctx context.Context) error {
	return ms.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec("delete from alert_rule")
		if err != nil {
			return err
		}

		_, err = sess.Exec("delete from alert_rule_version")
		if err != nil {
			return err
		}

		_, err = sess.Exec("delete from dashboard_acl where dashboard_id IN (select id from dashboard where created_by = ?)", FOLDER_CREATED_BY)
		if err != nil {
			return err
		}

		_, err = sess.Exec("delete from dashboard where created_by = ?", FOLDER_CREATED_BY)
		if err != nil {
			return err
		}

		_, err = sess.Exec("delete from alert_configuration")
		if err != nil {
			return err
		}

		_, err = sess.Exec("delete from ngalert_configuration")
		if err != nil {
			return err
		}

		_, err = sess.Exec("delete from alert_instance")
		if err != nil {
			return err
		}

		exists, err := sess.IsTableExist("kv_store")
		if err != nil {
			return err
		}

		if exists {
			_, err = sess.Exec("delete from kv_store where namespace = ?", notifier.KVNamespace)
			if err != nil {
				return err
			}
		}

		files, err := getSilenceFileNamesForAllOrgs(ms.cfg.DataPath)
		if err != nil {
			return err
		}
		for _, f := range files {
			if err := os.Remove(f); err != nil {
				ms.log.Error("alert migration error: failed to remove silence file", "file", f, "err", err)
			}
		}

		err = ms.SetMigrated(ctx, false)
		if err != nil {
			return fmt.Errorf("setting migration status: %w", err)
		}

		return nil
	})
}

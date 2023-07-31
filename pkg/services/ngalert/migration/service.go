package migration

import (
	"context"
	"fmt"
	"os"
	"strconv"

	pb "github.com/prometheus/alertmanager/silence/silencepb"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

const KVNamespace = "ngalert.migration"
const migratedKey = "migrated"

type MigrationService struct {
	store db.DB
	cfg   *setting.Cfg
	log   log.Logger
	kv    *kvstore.NamespacedKVStore
}

func NewMigrationService(log log.Logger, store db.DB, cfg *setting.Cfg, kvStore kvstore.KVStore) MigrationService {
	return MigrationService{
		log:   log,
		cfg:   cfg,
		store: store,
		kv:    kvstore.WithNamespace(kvStore, kvstore.AllOrganizations, KVNamespace),
	}
}

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

func (ms *MigrationService) SetMigrated(ctx context.Context, migrated bool) error {
	return ms.kv.Set(ctx, migratedKey, strconv.FormatBool(migrated))
}

func (ms *MigrationService) Start(ctx context.Context) error {
	migrated, err := ms.GetMigrated(ctx)
	if err != nil {
		return fmt.Errorf("getting migration status: %w", err)
	}
	if migrated == ms.cfg.UnifiedAlerting.IsEnabled() {
		// Nothing to do.
		return nil
	}

	if migrated {
		// If legacy alerting is also disabled, there is nothing to do
		if setting.AlertingEnabled != nil && !*setting.AlertingEnabled {
			return nil
		}

		// Safeguard to prevent data loss when migrating from UA to LA
		if !ms.cfg.ForceMigration {
			panic("Grafana has already been migrated to Unified Alerting.\nAny alert rules created while using Unified Alerting will be deleted by rolling back.\n\nSet force_migration=true in your grafana.ini and restart Grafana to roll back and delete Unified Alerting configuration data.")
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
	err = ms.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		mg := &migration{
			// We deduplicate for case-insensitive matching in MySQL-compatible backend flavours because they use case-insensitive collation.
			seenUIDs: uidSet{set: make(map[string]struct{}), caseInsensitive: ms.store.GetDialect().SupportEngine()},
			silences: make(map[int64][]*pb.MeshSilence),
			log:      ms.log,
			dialect:  ms.store.GetDialect(),
			cfg:      ms.cfg,
			store:    ms.store,
			sess:     sess.Session,
		}

		err := mg.Exec()
		if err != nil {
			return fmt.Errorf("executing migration: %w", err)
		}

		err = ms.SetMigrated(ctx, true)
		if err != nil {
			return fmt.Errorf("setting migration status: %w", err)
		}

		return nil
	})

	if err != nil {
		return fmt.Errorf("migration failed: %w", err)
	}

	return nil
}

func (ms *MigrationService) Revert(ctx context.Context) error {
	return ms.store.WithTransactionalDbSession(ctx, func(dbSess *db.Session) error {
		sess := dbSess.Session
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

		// Since both revert and this modifies kv_store, we use the same transaction in both writes to prevent Lock Wait Timeout.
		withTransaction := context.WithValue(ctx, sqlstore.ContextSessionKey{}, dbSess)
		err = ms.SetMigrated(withTransaction, false)
		if err != nil {
			return fmt.Errorf("setting migration status: %w", err)
		}

		return nil
	})
}

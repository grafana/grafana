package ualert

import (
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// KVNamespace is a vendored migration.KVNamespace.
var KVNamespace = "ngalert.migration"

// migratedKey is a vendored migration.migratedKey.
var migratedKey = "migrated"

// MigrationServiceMigration moves the legacy alert migration status from the migration log to kvstore.
func MigrationServiceMigration(mg *migrator.Migrator) {
	mg.AddMigration("set legacy alert migration status in kvstore", &migrationLogToKVStore{})
}

type migrationLogToKVStore struct {
	migrator.MigrationBase
}

func (c migrationLogToKVStore) SQL(migrator.Dialect) string {
	return codeMigration
}

func (c migrationLogToKVStore) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	migrationRun, err := sess.Table("migration_log").Get(&migrator.MigrationLog{MigrationID: migTitle})
	if err != nil {
		mg.Logger.Error("alert migration failure: could not get migration log", "error", err)
		return err
	}

	var anyOrg int64 = 0
	now := time.Now()
	entry := kvStoreV1Entry{
		OrgID:     &anyOrg,
		Namespace: &KVNamespace,
		Key:       &migratedKey,
		Value:     strconv.FormatBool(migrationRun),
		Created:   now,
		Updated:   now,
	}
	if _, errCreate := sess.Table("kv_store").Insert(&entry); errCreate != nil {
		mg.Logger.Error("failed to insert migration status to kvstore", "err", errCreate)
		return fmt.Errorf("failed to insert migration status to kvstore: %w", errCreate)
	}
	return nil
}

// kvStoreV1Entry is a vendored kvstore.Item.
type kvStoreV1Entry struct {
	ID        int64   `xorm:"pk autoincr 'id'"`
	OrgID     *int64  `xorm:"org_id"`
	Namespace *string `xorm:"namespace"`
	Key       *string `xorm:"key"`
	Value     string  `xorm:"value"`

	Created time.Time `xorm:"created"`
	Updated time.Time `xorm:"updated"`
}

package ualert

import (
	"fmt"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// typeKey is a vendored migration.typeKey.
var typeKey = "currentAlertingType"

// AlertingType is a vendored migration.store.AlertingType.
type alertingType string

const (
	Legacy          alertingType = "Legacy"
	UnifiedAlerting alertingType = "UnifiedAlerting"
)

// CreateOrgMigratedKVStoreEntries creates kv store entries for each organization if the migration has been run.
// This is needed now that we've changed the semantics of data loss when upgrading / rolling back. If a user who previously
// upgraded were to rollback and upgrade again without clean_upgrade, then since they don't have org-level migrated states
// it will attempt to upgrade their orgs as if they had never upgraded before. This will almost definitely fail with
// duplicate key errors.
//
// In addition, this changes the entry for orgId=0 to be better named as it no longer tracks whether the
// migration has been run, but rather the current alerting type of Grafana; Legacy or UnifiedAlerting. This is used to
// detect transitions between Legacy and UnifiedAlerting by comparing to the desired type in the configuration.
func CreateOrgMigratedKVStoreEntries(mg *migrator.Migrator) {
	mg.AddMigration("copy kvstore migration status to each org", &createOrgMigratedKVStoreEntries{})
}

type createOrgMigratedKVStoreEntries struct {
	migrator.MigrationBase
}

func (c createOrgMigratedKVStoreEntries) SQL(migrator.Dialect) string {
	return codeMigration
}

func (c createOrgMigratedKVStoreEntries) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	var anyOrg int64 = 0
	migrated := kvStoreV1Entry{
		OrgID:     &anyOrg,
		Namespace: &KVNamespace,
		Key:       &migratedKey,
	}
	has, err := sess.Table("kv_store").Get(&migrated)
	if err != nil {
		return err
	}

	if !has {
		mg.Logger.Debug("No migrated status in kvstore, nothing to set")
		return nil
	}

	// Rename old entry key and value.
	val := Legacy
	if migrated.Value == "true" {
		val = UnifiedAlerting
	}
	if _, err := sess.Table("kv_store").Where("id = ?", migrated.ID).Update(&kvStoreV1Entry{
		Key:   &typeKey,
		Value: string(val),
	}); err != nil {
		mg.Logger.Error("failed to rename org migrated status in kvstore", "err", err)
		return err
	}

	var orgs []struct {
		ID int64 `xorm:"id"`
	}
	if err := sess.SQL("select id from org").Find(&orgs); err != nil {
		return err
	}

	if len(orgs) == 0 {
		mg.Logger.Debug("no orgs, nothing to set in kvstore")
		return nil
	}

	for _, org := range orgs {
		id := org.ID
		entry := kvStoreV1Entry{
			OrgID:     &id,
			Namespace: &KVNamespace,
			Key:       &migratedKey,
			Value:     migrated.Value,
			Created:   migrated.Created,
			Updated:   migrated.Updated,
		}
		if _, errCreate := sess.Table("kv_store").Insert(&entry); errCreate != nil {
			mg.Logger.Error("failed to insert org migration status to kvstore", "err", errCreate)
			return fmt.Errorf("failed to insert org migration status to kvstore: %w", errCreate)
		}
	}

	return nil
}

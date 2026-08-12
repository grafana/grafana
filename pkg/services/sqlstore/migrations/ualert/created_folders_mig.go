package ualert

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// stateKey is a vendored migrationStore.stateKey.
var stateKey = "stateKey"

// CreatedFoldersMigration moves the record of created folders during legacy migration from Dashboard created_by=-8
// to the kvstore. If there are no dashboards with created_by=-.8, then nothing needs to be done.
func CreatedFoldersMigration(mg *migrator.Migrator) {
	mg.AddMigration("migrate record of created folders during legacy migration to kvstore", &createdFoldersToKVStore{})
}

type createdFoldersToKVStore struct {
	migrator.MigrationBase
}

func (c createdFoldersToKVStore) SQL(migrator.Dialect) string {
	return codeMigration
}

func (c createdFoldersToKVStore) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	var results []struct {
		UID   string `xorm:"uid"`
		OrgID int64  `xorm:"org_id"`
	}
	folderCreatedBy := -8
	if err := sess.SQL("select * from dashboard where created_by = ?", folderCreatedBy).Find(&results); err != nil {
		return err
	}

	if len(results) == 0 {
		mg.Logger.Debug("no dashboards with created_by=-8, nothing to set in kvstore")
		return nil
	}

	type orgMigrationState struct {
		OrgID          int64    `json:"orgId"`
		CreatedFolders []string `json:"createdFolders"`
	}
	states := make(map[int64]*orgMigrationState)
	for _, r := range results {
		if _, ok := states[r.OrgID]; !ok {
			states[r.OrgID] = &orgMigrationState{
				OrgID:          r.OrgID,
				CreatedFolders: []string{},
			}
		}
		states[r.OrgID].CreatedFolders = append(states[r.OrgID].CreatedFolders, r.UID)
	}

	now := time.Now()
	for _, state := range states {
		raw, err := json.Marshal(state)
		if err != nil {
			return err
		}

		orgId := state.OrgID
		entry := kvStoreV1Entry{
			OrgID:     &orgId,
			Namespace: &KVNamespace,
			Key:       &stateKey,
			Value:     string(raw),
			Created:   now,
			Updated:   now,
		}
		if _, errCreate := sess.Table("kv_store").Insert(&entry); errCreate != nil {
			mg.Logger.Error("failed to insert record of created folders to kvstore", "err", errCreate)
			return fmt.Errorf("failed to insert record of created folders to kvstore: %w", errCreate)
		}
	}

	return nil
}

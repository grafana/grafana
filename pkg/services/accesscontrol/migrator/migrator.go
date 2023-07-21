package migrator

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func MigrateScopeSplit(db db.DB, log log.Logger) error {
	t := time.Now()

	var muCnt sync.Mutex
	var cnt = 0

	// Search for the permissions to update
	var permissions []ac.Permission
	if errFind := db.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		return sess.SQL("SELECT * FROM permission WHERE NOT scope = '' AND identifier = ''").Find(&permissions)
	}); errFind != nil {
		log.Error("could not search for permissions to update", "migration", "scopeSplit", "error", errFind)
	}

	if len(permissions) == 0 {
		log.Debug("no permission require a scope split", "migration", "scopeSplit")
		return nil
	}

	// Use multiple workers to update the permissions new fields by batch
	errConcurrentUpdate := ac.ConcurrentBatch(ac.Concurrency, len(permissions), ac.BatchSize, func(start, end int) error {
		n := end - start
		// IDs to remove
		ids := make([]interface{}, 0, n)
		// Current batch of updated permissions
		batch := make([]ac.Permission, 0, n)

		// Prepare batch of updated permissions
		for i := start; i < end; i++ {
			ids = append(ids, permissions[i].ID)
			kind, attribute, identifier := permissions[i].SplitScope()
			batch = append(batch, ac.Permission{
				RoleID:     permissions[i].RoleID,
				Action:     permissions[i].Action,
				Scope:      permissions[i].Scope,
				Kind:       kind,
				Attribute:  attribute,
				Identifier: identifier,
				Created:    permissions[i].Created,
				Updated:    t,
			})
		}

		// Batch update the permissions
		if errBatchUpdate := db.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			if _, errDel := sess.In("id", ids...).Delete(&ac.Permission{}); errDel != nil {
				log.Error("error deleting permissions before reinsert", "migration", "scopeSplit", "error", errDel)
				return errDel
			}

			if _, errInsert := sess.Insert(&batch); errInsert != nil {
				log.Error("error reinserting permissions", "migration", "scopeSplit", "error", errInsert)
				return errInsert
			}
			return nil
		}); errBatchUpdate != nil {
			log.Error("error updating permission batch", "migration", "scopeSplit", "start", start, "end", end)
			return errBatchUpdate
		}

		// Update count
		muCnt.Lock()
		cnt += n
		muCnt.Unlock()

		return nil
	})
	if errConcurrentUpdate != nil {
		log.Error("could not migrate permissions", "migration", "scopeSplit", "total", len(permissions), "succeeded", cnt, "left", len(permissions)-cnt, "error", errConcurrentUpdate)
		return errConcurrentUpdate
	}

	log.Debug("migrated permissions", "migration", "scopeSplit", "total", len(permissions), "succeeded", cnt, "in", time.Since(t))
	return nil
}

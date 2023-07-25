package migrator

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
)

func MigrateScopeSplit(db db.DB, log log.Logger) error {
	t := time.Now()
	ctx := context.Background()

	var muCnt sync.Mutex
	var cnt = 0

	// Search for the permissions to update
	var permissions []ac.Permission
	if errFind := db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		return sess.SQL("SELECT * FROM permission WHERE NOT scope = '' AND identifier = ''").Find(&permissions)
	}); errFind != nil {
		log.Error("could not search for permissions to update", "migration", "scopeSplit", "error", errFind)
		return errFind
	}

	if len(permissions) == 0 {
		log.Debug("no permission require a scope split", "migration", "scopeSplit")
		return nil
	}

	// Use multiple workers to update the permissions new fields by batch
	errConcurrentUpdate := ac.ConcurrentBatch(ac.Concurrency, len(permissions), ac.BatchSize, func(start, end int) error {
		n := end - start
		// IDs to remove
		delQuery := "DELETE FROM permission WHERE id IN ("
		delArgs := make([]interface{}, 0, n)

		// Query to insert the updated permissions
		insertQuery := "INSERT INTO permission (id, role_id, action, scope, kind, attribute, identifier, created, updated) VALUES "
		insertArgs := make([]interface{}, 0, 9*n)

		// Prepare batch of updated permissions
		for i := start; i < end; i++ {
			kind, attribute, identifier := permissions[i].SplitScope()

			delQuery += "?,"
			delArgs = append(delArgs, permissions[i].ID)

			insertQuery += "(?, ?, ?, ?, ?, ?, ?, ?, ?),"
			insertArgs = append(insertArgs, permissions[i].ID, permissions[i].RoleID,
				permissions[i].Action, permissions[i].Scope,
				kind, attribute, identifier,
				permissions[i].Created, t,
			)
		}
		// Remove trailing ','
		insertQuery = insertQuery[:len(insertQuery)-1]

		// Remove trailing ',' and close brackets
		delQuery = delQuery[:len(delQuery)-1] + ")"

		// Batch update the permissions
		if errBatchUpdate := db.GetSqlxSession().WithTransaction(ctx, func(tx *session.SessionTx) error {
			if _, errDel := tx.Exec(ctx, delQuery, delArgs...); errDel != nil {
				log.Error("error deleting permissions before reinsert", "migration", "scopeSplit", "error", errDel)
				return errDel
			}

			if _, errInsert := tx.Exec(ctx, insertQuery, insertArgs...); errInsert != nil {
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

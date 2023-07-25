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
	cnt := 0

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

	// SQLite does not seem to handle concurrency well
	if db.GetDialect().DriverName() == "sqlite3" {
		errBatchUpdate := batch(len(permissions), ac.BatchSize, func(start, end int) error {
			if err := batchScopeSplitScope(ctx, log, db, permissions, t, end, start); err != nil {
				return err
			}

			cnt += end - start
			return nil
		})
		if errBatchUpdate != nil {
			log.Error("could not migrate permissions", "migration", "scopeSplit", "total", len(permissions), "succeeded", cnt, "left", len(permissions)-cnt, "error", errBatchUpdate)
			return errBatchUpdate
		}
	} else {
		var muCnt sync.Mutex

		// Use multiple workers to update the permissions new fields by batch
		errConcurrentUpdate := ac.ConcurrentBatch(ac.Concurrency, len(permissions), ac.BatchSize, func(start, end int) error {
			if err := batchScopeSplitScope(ctx, log, db, permissions, t, end, start); err != nil {
				return err
			}

			muCnt.Lock()
			cnt += end - start
			muCnt.Unlock()
			return nil
		})
		if errConcurrentUpdate != nil {
			log.Error("could not migrate permissions", "migration", "scopeSplit", "total", len(permissions), "succeeded", cnt, "left", len(permissions)-cnt, "error", errConcurrentUpdate)
			return errConcurrentUpdate
		}
	}

	log.Debug("migrated permissions", "migration", "scopeSplit", "total", len(permissions), "succeeded", cnt, "in", time.Since(t))
	return nil
}

func batchScopeSplitScope(ctx context.Context, log log.Logger, db db.DB, permissions []ac.Permission, t time.Time, end int, start int) error {
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
			log.Error("error saving permissions", "migration", "scopeSplit", "error", errDel)
			return errDel
		}
		if _, errInsert := tx.Exec(ctx, insertQuery, insertArgs...); errInsert != nil {
			log.Error("error saving permissions", "migration", "scopeSplit", "error", errInsert)
			return errInsert
		}
		return nil
	}); errBatchUpdate != nil {
		log.Error("error updating permission batch", "migration", "scopeSplit", "start", start, "end", end)
		return errBatchUpdate
	}

	return nil
}

func batch(count, batchSize int, eachFn func(start, end int) error) error {
	for i := 0; i < count; {
		end := i + batchSize
		if end > count {
			end = count
		}

		if err := eachFn(i, end); err != nil {
			return err
		}

		i = end
	}

	return nil
}

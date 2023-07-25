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

		var save [][]interface{}
		if db.GetDialect().DriverName() == "mysql" {
			save = saveQuerySQLite(start, end, permissions)
		} else {
			save = saveQuery(start, end, permissions)
		}

		// Batch update the permissions
		if errBatchUpdate := db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
			for i := range save {
				if _, errSave := sess.Exec(save[i]...); errSave != nil {
					log.Error("error saving permissions", "migration", "scopeSplit", "error", errSave)
					return errSave
				}
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

// This works on Postgres and MySQL but fails on SQLite (table lock)
func saveQuery(start int, end int, permissions []ac.Permission) [][]interface{} {
	t := time.Now()
	n := end - start

	// IDs to remove
	delQuery := "DELETE FROM permission WHERE id IN ("
	delArgs := make([]interface{}, 1, n+1)

	// Query to insert the updated permissions
	insertQuery := "INSERT INTO permission (id, role_id, action, scope, kind, attribute, identifier, created, updated) VALUES "
	insertArgs := make([]interface{}, 1, 9*n+1)

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
	insertArgs[0] = insertQuery

	// Remove trailing ',' and close brackets
	delQuery = delQuery[:len(delQuery)-1] + ")"
	delArgs[0] = delQuery

	return [][]interface{}{delArgs, insertArgs}
}

// This works on SQLite but results in a deadlock on MySQL (due to gap locking)
func saveQuerySQLite(start int, end int, permissions []ac.Permission) [][]interface{} {
	t := time.Now()
	n := end - start

	insertQuery := "REPLACE INTO permission (id, role_id, action, scope, kind, attribute, identifier, created, updated) VALUES "
	insertArgs := make([]interface{}, 1, 9*n+1)

	for i := start; i < end; i++ {
		kind, attribute, identifier := permissions[i].SplitScope()

		insertQuery += "(?, ?, ?, ?, ?, ?, ?, ?, ?),"
		insertArgs = append(insertArgs, permissions[i].ID, permissions[i].RoleID,
			permissions[i].Action, permissions[i].Scope,
			kind, attribute, identifier,
			permissions[i].Created, t,
		)
	}

	insertQuery = insertQuery[:len(insertQuery)-1]
	insertArgs[0] = insertQuery
	return [][]interface{}{insertArgs}
}

package serverlock

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

type serverLockDB struct {
	SQLStore db.DB
	tracer   tracing.Tracer
	log      log.Logger
}

func (sl *serverLockDB) AcquireLock(ctx context.Context, serverLock *serverLock) (bool, error) {
	ctx, span := sl.tracer.Start(ctx, "ServerLockService.acquireLock")
	defer span.End()
	var result bool

	err := sl.SQLStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		newVersion := serverLock.Version + 1
		sql := `UPDATE server_lock SET
			version = ?,
			last_execution = ?
		WHERE
			operation_uid = ? AND version = ?`

		res, err := dbSession.Exec(sql, newVersion, time.Now().Unix(),
			serverLock.OperationUID, serverLock.Version)
		if err != nil {
			return err
		}

		affected, err := res.RowsAffected()
		result = affected == 1

		return err
	})

	return result, err
}

func (sl *serverLockDB) GetOrCreate(ctx context.Context, actionName string) (*serverLock, error) {
	ctx, span := sl.tracer.Start(ctx, "ServerLockService.getOrCreate")
	defer span.End()

	var result *serverLock
	err := sl.SQLStore.WithTransactionalDbSession(ctx, func(dbSession *db.Session) error {
		sqlRes := &serverLock{}
		has, err := dbSession.SQL("SELECT * FROM server_lock WHERE operation_uid = ?",
			actionName).Get(sqlRes)
		if err != nil {
			return err
		}

		if has {
			result = sqlRes
			return nil
		}

		lockRow := &serverLock{
			OperationUID:  actionName,
			LastExecution: 0,
		}

		affected := int64(1)
		rawSQL := `INSERT INTO server_lock (operation_uid, last_execution, version) VALUES (?, ?, ?)`
		if sl.SQLStore.GetDBType() == migrator.Postgres {
			rawSQL += ` RETURNING id`
			var id int64
			_, err := dbSession.SQL(rawSQL, lockRow.OperationUID, lockRow.LastExecution, 0).Get(&id)
			if err != nil {
				return err
			}
			lockRow.Id = id
		} else {
			res, err := dbSession.Exec(
				rawSQL,
				lockRow.OperationUID, lockRow.LastExecution, 0)
			if err != nil {
				return err
			}
			lastID, err := res.LastInsertId()
			if err != nil {
				sl.log.FromContext(ctx).Error("Error getting last insert id", "actionName", actionName, "error", err)
			}
			lockRow.Id = lastID

			affected, err = res.RowsAffected()
			if err != nil {
				sl.log.FromContext(ctx).Error("Error getting rows affected", "actionName", actionName, "error", err)
			}
		}

		if affected != 1 || lockRow.Id == 0 {
			// this means that there was no error but there is something not working correctly
			sl.log.FromContext(ctx).Error("Expected rows affected to be 1 if there was no error",
				"actionName", actionName,
				"rowsAffected", affected,
				"lockRow ID", lockRow.Id)
		}

		result = lockRow
		return nil
	})

	return result, err
}

// acquireForRelease will check if the lock is already on the database, if it is, will check with maxInterval if it is
// timeouted. Returns nil error if the lock was acquired correctly
func (sl *serverLockDB) AcquireForRelease(ctx context.Context, actionName string, maxInterval time.Duration) error {
	ctx, span := sl.tracer.Start(ctx, "ServerLockService.acquireForRelease")
	defer span.End()

	// getting the lock - as the action name has a Unique constraint, this will fail if the lock is already on the database
	err := sl.SQLStore.WithTransactionalDbSession(ctx, func(dbSession *db.Session) error {
		// we need to find if the lock is in the database
		result := &serverLock{}
		sqlRaw := `SELECT * FROM server_lock WHERE operation_uid = ?`
		if sl.SQLStore.GetDBType() == migrator.MySQL || sl.SQLStore.GetDBType() == migrator.Postgres {
			sqlRaw += ` FOR UPDATE`
		}

		has, err := dbSession.SQL(
			sqlRaw,
			actionName).Get(result)
		if err != nil {
			return err
		}

		ctxLogger := sl.log.FromContext(ctx)

		if has {
			if isLockWithinInterval(result, maxInterval) {
				return &ServerLockExistsError{actionName: actionName}
			} else {
				// lock has timed out, so we update the timestamp
				result.LastExecution = time.Now().Unix()
				res, err := dbSession.Exec("UPDATE server_lock SET last_execution = ? WHERE operation_uid = ?",
					result.LastExecution, actionName)
				if err != nil {
					return err
				}

				affected, err := res.RowsAffected()
				if err != nil {
					ctxLogger.Error("Error getting rows affected", "actionName", actionName, "error", err)
				}

				if affected != 1 {
					ctxLogger.Error("Expected rows affected to be 1 if there was no error", "actionName", actionName, "rowsAffected", affected)
				}

				return nil
			}
		} else {
			// lock not found, creating it
			res, err := dbSession.Exec(
				"INSERT INTO server_lock (operation_uid, last_execution, version) VALUES (?, ?, ?)",
				actionName, time.Now().Unix(), 0)
			if err != nil {
				return err
			}

			affected, err := res.RowsAffected()
			if err != nil {
				ctxLogger.Error("Error getting rows affected", "actionName", actionName, "error", err)
			}

			lastID, err := res.LastInsertId()
			if err != nil {
				ctxLogger.Error("Error getting last insert id", "actionName", actionName, "error", err)
			}

			if affected != 1 || lastID == 0 {
				// this means that there was no error but there is something not working correctly
				ctxLogger.Error("Expected rows affected to be 1 if there was no error",
					"actionName", actionName,
					"rowsAffected", affected,
					"lastID", lastID)
			}
		}
		return nil
	})

	return err
}

// releaseLock will delete the row at the database. This is only intended to be used within the scope of LockExecuteAndRelease
// method, but not as to manually release a Lock
func (sl *serverLockDB) ReleaseLock(ctx context.Context, actionName string) error {
	ctx, span := sl.tracer.Start(ctx, "ServerLockService.releaseLock")
	defer span.End()

	err := sl.SQLStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		sql := `DELETE FROM server_lock WHERE operation_uid=? `

		res, err := dbSession.Exec(sql, actionName)
		if err != nil {
			return err
		}
		affected, err := res.RowsAffected()
		if err != nil {
			sl.log.FromContext(ctx).Debug("Error getting rows affected", "actionName", actionName, "error", err)
		}

		if affected != 1 {
			sl.log.FromContext(ctx).Debug("Error releasing lock", "actionName", actionName, "rowsAffected", affected)
		}
		return nil
	})

	return err
}

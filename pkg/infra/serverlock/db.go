package serverlock

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
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
			id = ? AND version = ?`

		res, err := dbSession.Exec(sql, newVersion, time.Now().Unix(), serverLock.Id, serverLock.Version)
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
		lockRows := []*serverLock{}
		err := dbSession.Where("operation_uid = ?", actionName).Find(&lockRows)
		if err != nil {
			return err
		}

		if len(lockRows) > 0 {
			result = lockRows[0]
			return nil
		}

		lockRow := &serverLock{
			OperationUID:  actionName,
			LastExecution: 0,
		}

		_, err = dbSession.Insert(lockRow)
		if err != nil {
			return err
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
		lockRows := []*serverLock{}
		err := dbSession.Where("operation_uid = ?", actionName).Find(&lockRows)
		if err != nil {
			return err
		}

		ctxLogger := sl.log.FromContext(ctx)

		if len(lockRows) > 0 {
			result := lockRows[0]
			if isLockWithinInterval(result, maxInterval) {
				return &ServerLockExistsError{actionName: actionName}
			} else {
				// lock has timeouted, so we update the timestamp
				result.LastExecution = time.Now().Unix()
				cond := &serverLock{OperationUID: actionName}
				affected, err := dbSession.Update(result, cond)
				if err != nil {
					return err
				}
				if affected != 1 {
					ctxLogger.Error("Expected rows affected to be 1 if there was no error", "actionName", actionName, "rowsAffected", affected)
				}
				return nil
			}
		} else {
			// lock not found, creating it
			lockRow := &serverLock{
				OperationUID:  actionName,
				LastExecution: time.Now().Unix(),
			}

			affected, err := dbSession.Insert(lockRow)
			if err != nil {
				return err
			}

			if affected != 1 {
				// this means that there was no error but there is something not working correctly
				ctxLogger.Error("Expected rows affected to be 1 if there was no error", "actionName", actionName, "rowsAffected", affected)
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
		if affected != 1 {
			sl.log.FromContext(ctx).Debug("Error releasing lock", "actionName", actionName, "rowsAffected", affected)
		}
		return err
	})

	return err
}

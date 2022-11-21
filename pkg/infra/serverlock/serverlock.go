package serverlock

import (
	"context"
	"time"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

func ProvideService(sqlStore db.DB, tracer tracing.Tracer) *ServerLockService {
	return &ServerLockService{
		SQLStore: sqlStore,
		tracer:   tracer,
		log:      log.New("infra.lockservice"),
	}
}

// ServerLockService allows servers in HA mode to claim a lock and execute a function if the server was granted the lock
// It exposes 2 services LockAndExecute and LockExecuteAndRelease, which are intended to be used independently, don't mix
// them up (ie, use the same actionName for both of them).
type ServerLockService struct {
	SQLStore db.DB
	tracer   tracing.Tracer
	log      log.Logger
}

// LockAndExecute try to create a lock for this server and only executes the
// `fn` function when successful. This should not be used at low internal. But services
// that needs to be run once every ex 10m.
func (sl *ServerLockService) LockAndExecute(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error {
	start := time.Now()
	ctx, span := sl.tracer.Start(ctx, "ServerLockService.LockAndExecute")
	span.SetAttributes("serverlock.actionName", actionName, attribute.Key("serverlock.actionName").String(actionName))
	defer span.End()

	ctxLogger := sl.log.FromContext(ctx)
	ctxLogger.Debug("Start LockAndExecute", "actionName", actionName)

	// gets or creates a lockable row
	rowLock, err := sl.getOrCreate(ctx, actionName)
	if err != nil {
		span.RecordError(err)
		return err
	}

	// avoid execution if last lock happened less than `maxInterval` ago
	if sl.isLockWithinInterval(rowLock, maxInterval) {
		return nil
	}

	// try to get lock based on rowLock version
	acquiredLock, err := sl.acquireLock(ctx, rowLock)
	if err != nil {
		span.RecordError(err)
		return err
	}

	if acquiredLock {
		sl.executeFunc(ctx, actionName, fn)
	}

	ctxLogger.Debug("LockAndExecute finished", "actionName", actionName, "acquiredLock", acquiredLock, "duration", time.Since(start))

	return nil
}

func (sl *ServerLockService) acquireLock(ctx context.Context, serverLock *serverLock) (bool, error) {
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

func (sl *ServerLockService) getOrCreate(ctx context.Context, actionName string) (*serverLock, error) {
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

// LockExecuteAndRelease Creates the lock, executes the func, and then release the locks. The locking mechanism is
// based on the UNIQUE constraint of the actionName in the database (column  operation_uid), so a new process can not insert
// a new operation if already exists one. The parameter 'maxInterval' is a timeout safeguard, if the LastExecution in the
// database is older than maxInterval, we will assume the lock as timeouted. The 'maxInterval' parameter should be so long
// that is impossible for 2 processes to run at the same time.
func (sl *ServerLockService) LockExecuteAndRelease(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error {
	start := time.Now()
	ctx, span := sl.tracer.Start(ctx, "ServerLockService.LockExecuteAndRelease")
	span.SetAttributes("serverlock.actionName", actionName, attribute.Key("serverlock.actionName").String(actionName))
	defer span.End()

	ctxLogger := sl.log.FromContext(ctx)
	ctxLogger.Debug("Start LockExecuteAndRelease", "actionName", actionName)

	err := sl.acquireForRelease(ctx, actionName, maxInterval)
	// could not get the lock, returning
	if err != nil {
		span.RecordError(err)
		return err
	}

	sl.executeFunc(ctx, actionName, fn)

	err = sl.releaseLock(ctx, actionName)
	if err != nil {
		span.RecordError(err)
		ctxLogger.Error("Failed to release the lock", "error", err)
	}

	ctxLogger.Debug("LockExecuteAndRelease finished", "actionName", actionName, "duration", time.Since(start))

	return nil
}

// acquireForRelease will check if the lock is already on the database, if it is, will check with maxInterval if it is
// timeouted. Returns nil error if the lock was acquired correctly
func (sl *ServerLockService) acquireForRelease(ctx context.Context, actionName string, maxInterval time.Duration) error {
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
			if sl.isLockWithinInterval(result, maxInterval) {
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
func (sl *ServerLockService) releaseLock(ctx context.Context, actionName string) error {
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

func (sl *ServerLockService) isLockWithinInterval(lock *serverLock, maxInterval time.Duration) bool {
	if lock.LastExecution != 0 {
		lastExecutionTime := time.Unix(lock.LastExecution, 0)
		if time.Since(lastExecutionTime) < maxInterval {
			return true
		}
	}
	return false
}

func (sl ServerLockService) executeFunc(ctx context.Context, actionName string, fn func(ctx context.Context)) {
	start := time.Now()
	ctx, span := sl.tracer.Start(ctx, "ServerLockService.executeFunc")
	defer span.End()

	ctxLogger := sl.log.FromContext(ctx)
	ctxLogger.Debug("Start execution", "actionName", actionName)

	fn(ctx)

	ctxLogger.Debug("Execution finished", "actionName", actionName, "duration", time.Since(start))
}

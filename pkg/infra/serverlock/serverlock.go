package serverlock

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func ProvideService(sqlStore *sqlstore.SQLStore) *ServerLockService {
	return &ServerLockService{
		SQLStore: sqlStore,
		log:      log.New("infra.lockservice"),
	}
}

// ServerLockService allows servers in HA mode to claim a lock and execute a function if the server was granted the lock
// It exposes 2 services LockAndExecute and LockExecuteAndRelease, which are intended to be used independently, don't mix
// them up (ie, use the same actionName for both of them).
type ServerLockService struct {
	SQLStore *sqlstore.SQLStore
	log      log.Logger
}

// LockAndExecute try to create a lock for this server and only executes the
// `fn` function when successful. This should not be used at low internal. But services
// that needs to be run once every ex 10m.
func (sl *ServerLockService) LockAndExecute(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error {
	// gets or creates a lockable row
	rowLock, err := sl.getOrCreate(ctx, actionName)
	if err != nil {
		return err
	}

	// avoid execution if last lock happened less than `maxInterval` ago
	if sl.isLockWithinInterval(rowLock, maxInterval) {
		return nil
	}

	// try to get lock based on rowLow version
	acquiredLock, err := sl.acquireLock(ctx, rowLock)
	if err != nil {
		return err
	}

	if acquiredLock {
		fn(ctx)
	}

	return nil
}

func (sl *ServerLockService) acquireLock(ctx context.Context, serverLock *serverLock) (bool, error) {
	var result bool

	err := sl.SQLStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
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
	var result *serverLock

	err := sl.SQLStore.WithTransactionalDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
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
	err := sl.acquireForRelease(ctx, actionName, maxInterval)
	// could not get the lock, returning
	if err != nil {
		return err
	}

	// execute!
	fn(ctx)

	err = sl.releaseLock(ctx, actionName)
	if err != nil {
		sl.log.Error("Error releasing the lock.", err)
	}

	return nil
}

// acquireForRelease will check if the lock is already on the database, if it is, will check with maxInterval if it is
// timeouted. Returns nil error if the lock was acquired correctly
func (sl *ServerLockService) acquireForRelease(ctx context.Context, actionName string, maxInterval time.Duration) error {
	// getting the lock - as the action name has a Unique constraint, this will fail if the lock is already on the database
	err := sl.SQLStore.WithTransactionalDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		// we need to find if the lock is in the database
		lockRows := []*serverLock{}
		err := dbSession.Where("operation_uid = ?", actionName).Find(&lockRows)
		if err != nil {
			return err
		}

		if len(lockRows) > 0 {
			result := lockRows[0]
			if sl.isLockWithinInterval(result, maxInterval) {
				return errors.New("there is already a lock for this actionName: " + actionName)
			} else {
				// lock has timeouted, so we update the timestamp
				result.LastExecution = time.Now().Unix()
				cond := &serverLock{OperationUID: actionName}
				affected, err := dbSession.Update(result, cond)
				if err != nil {
					return err
				}
				if affected != 1 {
					sl.log.Error("Expected rows affected to be 1 if there was no error.", "actionName", actionName, "rowAffected", affected)
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
				sl.log.Error("Expected rows affected to be 1 if there was no error.", "actionName", actionName, "rowAffected", affected)
			}
		}
		return nil
	})
	return err
}

// releaseLock will delete the row at the database. This is only intended to be used within the scope of LockExecuteAndRelease
// method, but not as to manually release a Lock
func (sl *ServerLockService) releaseLock(ctx context.Context, actionName string) error {
	err := sl.SQLStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		sql := `DELETE FROM server_lock WHERE operation_uid=? `

		res, err := dbSession.Exec(sql, actionName)
		if err != nil {
			return err
		}
		affected, err := res.RowsAffected()
		if affected != 1 {
			sl.log.Debug("Error releasing lock ", "actionName", actionName, "affected", affected)
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

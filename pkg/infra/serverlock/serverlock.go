package serverlock

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func init() {
	registry.RegisterService(&ServerLockService{})
}

// ServerLockService allows servers in HA mode to execute function once over in the group
type ServerLockService struct {
	SQLStore *sqlstore.SqlStore `inject:""`
	log      log.Logger
}

// Init this service
func (sl *ServerLockService) Init() error {
	return nil
}

// OncePerServerGroup try to create a lock for this server and only executes the
// `fn` function when successful. This should not be used at low internal. But services
// that needs to be run once every ex 10m.
func (sl *ServerLockService) OncePerServerGroup(ctx context.Context, actionName string, maxEvery time.Duration, fn func()) error {
	rowLock, err := sl.getOrCreate(ctx, actionName)
	if err != nil {
		return err
	}

	if rowLock.LastExecution != 0 {
		lastExeuctionTime := time.Unix(rowLock.LastExecution, 0)
		if lastExeuctionTime.Unix() > time.Now().Add(-maxEvery).Unix() {
			return nil
		}
	}

	acquiredLock, err := sl.acquireLock(ctx, rowLock, maxEvery)
	if err != nil {
		return err
	}

	if acquiredLock {
		fn()
	}

	return nil
}

func (sl *ServerLockService) acquireLock(ctx context.Context, serverLock *serverLock, maxEvery time.Duration) (bool, error) {
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
			OperationUid:  actionName,
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

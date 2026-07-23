package serverlock

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/go-sql-driver/mysql"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

func ProvideService(sql legacysql.LegacyDatabaseProvider, tracer tracing.Tracer) *ServerLockService {
	return &ServerLockService{
		sql:    sql,
		tracer: tracer,
		log:    log.New("infra.lockservice"),
	}
}

// ServerLockService allows servers in HA mode to claim a lock and execute a function if the server was granted the lock
// It exposes 2 services LockAndExecute and LockExecuteAndRelease, which are intended to be used independently, don't mix
// them up (ie, use the same actionName for both of them).
type ServerLockService struct {
	sql    legacysql.LegacyDatabaseProvider
	tracer tracing.Tracer
	log    log.Logger
}

// LockAndExecute try to create a lock for this server and only executes the
// `fn` function when successful. This should not be used at low internal. But services
// that needs to be run once every ex 10m.
func (sl *ServerLockService) LockAndExecute(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error {
	start := time.Now()
	ctx, span := sl.tracer.Start(ctx, "ServerLockService.LockAndExecute")
	span.SetAttributes(attribute.String("serverlock.actionName", actionName))
	defer span.End()

	ctxLogger := sl.log.FromContext(ctx)
	ctxLogger.Debug("Start LockAndExecute", "actionName", actionName)

	// gets or creates a lockable row
	rowLock, err := sl.getOrCreate(ctx, actionName)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, fmt.Sprintf("failed to getOrCreate serverlock: %v", err))
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
		span.SetStatus(codes.Error, fmt.Sprintf("failed to acquire serverlock: %v", err))
		return err
	}

	if acquiredLock {
		sl.executeFunc(ctx, actionName, fn)
	}

	ctxLogger.Debug("LockAndExecute finished", "actionName", actionName, "acquiredLock", acquiredLock, "duration", time.Since(start))

	return nil
}

type updateVersionQuery struct {
	sqltemplate.SQLTemplate
	ServerLockTable string
	Version         int64
	LastExecution   int64
	OperationUID    string
	PreviousVersion int64
}

func (updateVersionQuery) Validate() error {
	return nil
}

func (sl *ServerLockService) acquireLock(ctx context.Context, serverLock *serverLock) (bool, error) {
	ctx, span := sl.tracer.Start(ctx, "ServerLockService.acquireLock")
	defer span.End()
	var result bool

	dbHelper, err := sl.sql(ctx)
	if err != nil {
		return false, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
		query := updateVersionQuery{
			SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
			ServerLockTable: dbHelper.Table("server_lock"),
			Version:         serverLock.Version + 1,
			LastExecution:   time.Now().Unix(),
			OperationUID:    serverLock.OperationUID,
			PreviousVersion: serverLock.Version,
		}
		rawSQL, err := sqltemplate.Execute(updateVersionTemplate, query)
		if err != nil {
			return err
		}
		res, err := dbSession.Exec(append([]any{rawSQL}, query.GetArgs()...)...)
		if err != nil {
			return err
		}

		affected, err := res.RowsAffected()
		result = affected == 1

		return err
	})

	return result, err
}

type getLockQuery struct {
	sqltemplate.SQLTemplate
	ServerLockTable string
	OperationUID    string
}

func (getLockQuery) Validate() error {
	return nil
}

func (sl *ServerLockService) getOrCreate(ctx context.Context, actionName string) (*serverLock, error) {
	ctx, span := sl.tracer.Start(ctx, "ServerLockService.getOrCreate")
	defer span.End()

	var result *serverLock
	dbHelper, err := sl.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithTransactionalDbSession(ctx, func(dbSession *db.Session) error {
		query := getLockQuery{
			SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
			ServerLockTable: dbHelper.Table("server_lock"),
			OperationUID:    actionName,
		}
		rawSQL, err := sqltemplate.Execute(getLockTemplate, query)
		if err != nil {
			return err
		}
		sqlRes := &serverLock{}
		has, err := dbSession.SQL(rawSQL, query.GetArgs()...).Get(sqlRes)
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
		result, err = sl.createLock(ctx, lockRow, dbHelper, dbSession)
		return err
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
	span.SetAttributes(attribute.String("serverlock.actionName", actionName))
	defer span.End()

	ctxLogger := sl.log.FromContext(ctx)
	ctxLogger.Debug("Start LockExecuteAndRelease", "actionName", actionName)

	err := sl.acquireForRelease(ctx, actionName, maxInterval)
	// could not get the lock, returning
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, fmt.Sprintf("failed to acquire serverlock: %v", err))
		return err
	}

	sl.executeFunc(ctx, actionName, fn)

	err = sl.releaseLock(ctx, actionName)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, fmt.Sprintf("failed to release serverlock: %v", err))
		ctxLogger.Error("Failed to release the lock", "error", err)
	}

	ctxLogger.Debug("LockExecuteAndRelease finished", "actionName", actionName, "duration", time.Since(start))

	return nil
}

// RetryOpt is a callback function called after each failed lock acquisition try.
// It gets the number of tries passed as an arg.
type RetryOpt func(int) error

type LockTimeConfig struct {
	MaxInterval time.Duration // Duration after which we consider a lock to be dead and overtake it. Make sure this is big enough so that a server cannot acquire the lock while another server is processing.
	MinWait     time.Duration // Minimum time to wait before retrying to acquire the lock.
	MaxWait     time.Duration // Maximum time to wait before retrying to acquire the lock.
}

// LockExecuteAndReleaseWithRetries mimics LockExecuteAndRelease but waits for the lock to be released if it is already taken.
func (sl *ServerLockService) LockExecuteAndReleaseWithRetries(ctx context.Context, actionName string, timeConfig LockTimeConfig, fn func(ctx context.Context), retryOpts ...RetryOpt) error {
	start := time.Now()
	ctx, span := sl.tracer.Start(ctx, "ServerLockService.LockExecuteAndReleaseWithRetries")
	span.SetAttributes(attribute.String("serverlock.actionName", actionName))
	defer span.End()

	ctxLogger := sl.log.FromContext(ctx)
	ctxLogger.Debug("Start LockExecuteAndReleaseWithRetries", "actionName", actionName)

	lockChecks := 0

	for {
		lockChecks++
		err := sl.acquireForRelease(ctx, actionName, timeConfig.MaxInterval)
		// could not get the lock
		if err != nil {
			var lockedErr *ServerLockExistsError
			var deadlockErr *mysql.MySQLError
			if errors.As(err, &lockedErr) || (errors.As(err, &deadlockErr) && deadlockErr.Number == 1213) {
				// if the lock is already taken, wait and try again
				if lockChecks == 1 { // only warn on first lock check
					ctxLogger.Warn("another instance has the lock, waiting for it to be released", "actionName", actionName)
				}

				for _, op := range retryOpts {
					if err := op(lockChecks); err != nil {
						return err
					}
				}

				time.Sleep(lockWait(timeConfig.MinWait, timeConfig.MaxWait))
				continue
			}
			span.RecordError(err)
			span.SetStatus(codes.Error, fmt.Sprintf("failed to acquire serverlock: %v", err))
			return err
		}

		// lock was acquired and released successfully
		break
	}

	sl.executeFunc(ctx, actionName, fn)

	if err := sl.releaseLock(ctx, actionName); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, fmt.Sprintf("failed to release serverlock: %v", err))
		ctxLogger.Error("Failed to release the lock", "error", err)
	}

	ctxLogger.Debug("LockExecuteAndReleaseWithRetries finished", "actionName", actionName, "duration", time.Since(start))

	return nil
}

// generate a random duration between minWait and maxWait to ensure instances unlock gradually
func lockWait(minWait time.Duration, maxWait time.Duration) time.Duration {
	return time.Duration(rand.Int63n(int64(maxWait-minWait)) + int64(minWait))
}

type getLockForUpdateQuery struct {
	sqltemplate.SQLTemplate
	ServerLockTable string
	OperationUID    string
}

func (getLockForUpdateQuery) Validate() error {
	return nil
}

type updateLastExecutionQuery struct {
	sqltemplate.SQLTemplate
	ServerLockTable string
	LastExecution   int64
	OperationUID    string
}

func (updateLastExecutionQuery) Validate() error {
	return nil
}

// acquireForRelease will check if the lock is already on the database, if it is, will check with maxInterval if it is
// timeouted. Returns nil error if the lock was acquired correctly
func (sl *ServerLockService) acquireForRelease(ctx context.Context, actionName string, maxInterval time.Duration) error {
	ctx, span := sl.tracer.Start(ctx, "ServerLockService.acquireForRelease")
	defer span.End()

	dbHelper, err := sl.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	// getting the lock - as the action name has a Unique constraint, this will fail if the lock is already on the database
	err = dbHelper.DB.WithTransactionalDbSession(ctx, func(dbSession *db.Session) error {
		query := getLockForUpdateQuery{
			SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
			ServerLockTable: dbHelper.Table("server_lock"),
			OperationUID:    actionName,
		}
		rawSQL, err := sqltemplate.Execute(getLockForUpdateTemplate, query)
		if err != nil {
			return err
		}
		// we need to find if the lock is in the database
		result := &serverLock{}
		has, err := dbSession.SQL(rawSQL, query.GetArgs()...).Get(result)
		if err != nil {
			return err
		}

		ctxLogger := sl.log.FromContext(ctx)

		if has {
			if sl.isLockWithinInterval(result, maxInterval) {
				return &ServerLockExistsError{actionName: actionName}
			}
			// lock has timed out, so we update the timestamp
			result.LastExecution = time.Now().Unix()
			updateQuery := updateLastExecutionQuery{
				SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
				ServerLockTable: dbHelper.Table("server_lock"),
				LastExecution:   result.LastExecution,
				OperationUID:    actionName,
			}
			updateSQL, err := sqltemplate.Execute(updateLastExecutionTemplate, updateQuery)
			if err != nil {
				return err
			}
			res, err := dbSession.Exec(append([]any{updateSQL}, updateQuery.GetArgs()...)...)
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

		// lock not found, creating it
		lock := &serverLock{
			OperationUID:  actionName,
			LastExecution: time.Now().Unix(),
		}
		_, err = sl.createLock(ctx, lock, dbHelper, dbSession)
		return err
	})

	return err
}

type releaseLockQuery struct {
	sqltemplate.SQLTemplate
	ServerLockTable string
	OperationUID    string
}

func (releaseLockQuery) Validate() error {
	return nil
}

// releaseLock will delete the row at the database. This is only intended to be used within the scope of LockExecuteAndRelease
// method, but not as to manually release a Lock
func (sl *ServerLockService) releaseLock(ctx context.Context, actionName string) error {
	ctx, span := sl.tracer.Start(ctx, "ServerLockService.releaseLock")
	defer span.End()

	// ensure clean up happens even if the context is cancelled
	dbCtx := context.WithoutCancel(ctx)

	dbHelper, err := sl.sql(dbCtx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(dbCtx, func(dbSession *db.Session) error {
		query := releaseLockQuery{
			SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
			ServerLockTable: dbHelper.Table("server_lock"),
			OperationUID:    actionName,
		}
		rawSQL, err := sqltemplate.Execute(releaseLockTemplate, query)
		if err != nil {
			return err
		}
		res, err := dbSession.Exec(append([]any{rawSQL}, query.GetArgs()...)...)
		if err != nil {
			return err
		}
		affected, err := res.RowsAffected()
		if err != nil {
			sl.log.FromContext(dbCtx).Debug("Error getting rows affected", "actionName", actionName, "error", err)
		}

		if affected != 1 {
			sl.log.FromContext(dbCtx).Debug("Error releasing lock", "actionName", actionName, "rowsAffected", affected)
		}
		return nil
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

func (sl *ServerLockService) executeFunc(ctx context.Context, actionName string, fn func(ctx context.Context)) {
	start := time.Now()
	ctx, span := sl.tracer.Start(ctx, "ServerLockService.executeFunc")
	defer span.End()

	ctxLogger := sl.log.FromContext(ctx)
	ctxLogger.Debug("Start execution", "actionName", actionName)

	fn(ctx)

	ctxLogger.Debug("Execution finished", "actionName", actionName, "duration", time.Since(start))
}

type createLockQuery struct {
	sqltemplate.SQLTemplate
	ServerLockTable string
	OperationUID    string
	LastExecution   int64
	Version         int64
}

func (createLockQuery) Validate() error {
	return nil
}

func (sl *ServerLockService) createLock(ctx context.Context,
	lockRow *serverLock, dbHelper *legacysql.LegacyDatabaseHelper, dbSession *sqlstore.DBSession,
) (*serverLock, error) {
	affected := int64(1)
	query := createLockQuery{
		SQLTemplate:     sqltemplate.New(dbHelper.DialectForDriver()),
		ServerLockTable: dbHelper.Table("server_lock"),
		OperationUID:    lockRow.OperationUID,
		LastExecution:   lockRow.LastExecution,
		Version:         0,
	}
	rawSQL, err := sqltemplate.Execute(createLockTemplate, query)
	if err != nil {
		return nil, err
	}
	if query.DialectName() == "postgres" {
		var id int64
		_, err := dbSession.SQL(rawSQL, query.GetArgs()...).Get(&id)
		if err != nil {
			return nil, err
		}
		if id == 0 {
			// Considering the default isolation level (READ COMMITTED), an entry could be added to the table
			// between the SELECT and the INSERT. And inserting a row with the same operation_uid would violate the unique
			// constraint. In this case, the ON CONFLICT DO NOTHING clause will prevent generating an error.
			// And the returning id will be 0 which means that there wasn't any row inserted (another server has the lock),
			// therefore we return the ServerLockExistsError.
			// https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED
			return nil, &ServerLockExistsError{actionName: lockRow.OperationUID}
		}
		lockRow.Id = id
	} else {
		res, err := dbSession.Exec(append([]any{rawSQL}, query.GetArgs()...)...)
		if err != nil {
			return nil, err
		}
		lastID, err := res.LastInsertId()
		if err != nil {
			sl.log.FromContext(ctx).Error("Error getting last insert id", "actionName", lockRow.OperationUID, "error", err)
		}
		lockRow.Id = lastID

		affected, err = res.RowsAffected()
		if err != nil {
			sl.log.FromContext(ctx).Error("Error getting rows affected", "actionName", lockRow.OperationUID, "error", err)
		}
	}

	if affected != 1 || lockRow.Id == 0 {
		sl.log.FromContext(ctx).Error("Expected rows affected to be 1 if there was no error",
			"actionName", lockRow.OperationUID,
			"rowsAffected", affected,
			"lockRow ID", lockRow.Id)
	}

	return lockRow, nil
}

package serverlock

import (
	"context"
	"errors"
	"math/rand"
	"time"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
)

type locker interface {
	GetOrCreate(ctx context.Context, actionName string) (*serverLock, error)
	AcquireLock(ctx context.Context, serverLock *serverLock) (bool, error)
	AcquireForRelease(ctx context.Context, actionName string, maxInterval time.Duration) error
	ReleaseLock(ctx context.Context, actionName string) error
}

func ProvideService(sqlStore db.DB, tracer tracing.Tracer, cfg *setting.Cfg, remoteCache *remotecache.RemoteCache) *ServerLockService {
	logger := log.New("infra.lockservice")

	if cfg != nil && cfg.ServerLock.Driver == setting.DatabaseLockType {
		if remoteCache != nil && cfg.RemoteCacheOptions != nil && cfg.RemoteCacheOptions.Name != setting.DatabaseCacheType {
			logger.Debug("Server lock configured with remote cache")
			// return NewRemoteCacheServerLockService(remoteCache, tracer)
		}

		logger.Warn("Remote cache is not configured with non database type, using database lock")
	}

	return &ServerLockService{
		tracer: tracer,
		log:    logger,
		locker: &serverLockDB{
			SQLStore: sqlStore,
			tracer:   tracer,
			log:      log.New("infra.lockservice.db"),
		},
	}
}

// ServerLockService allows servers in HA mode to claim a lock and execute a function if the server was granted the lock
// It exposes 2 services LockAndExecute and LockExecuteAndRelease, which are intended to be used independently, don't mix
// them up (ie, use the same actionName for both of them).
type ServerLockService struct {
	locker locker
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
	rowLock, err := sl.locker.GetOrCreate(ctx, actionName)
	if err != nil {
		span.RecordError(err)
		return err
	}

	// avoid execution if last lock happened less than `maxInterval` ago
	if isLockWithinInterval(rowLock, maxInterval) {
		return nil
	}

	// try to get lock based on rowLock version
	acquiredLock, err := sl.locker.AcquireLock(ctx, rowLock)
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

	err := sl.locker.AcquireForRelease(ctx, actionName, maxInterval)
	// could not get the lock, returning
	if err != nil {
		span.RecordError(err)
		return err
	}

	sl.executeFunc(ctx, actionName, fn)

	err = sl.locker.ReleaseLock(ctx, actionName)
	if err != nil {
		span.RecordError(err)
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
		err := sl.locker.AcquireForRelease(ctx, actionName, timeConfig.MaxInterval)
		// could not get the lock
		if err != nil {
			var lockedErr *ServerLockExistsError
			if errors.As(err, &lockedErr) {
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
			return err
		}

		// lock was acquired and released successfully
		break
	}

	sl.executeFunc(ctx, actionName, fn)

	if err := sl.locker.ReleaseLock(ctx, actionName); err != nil {
		span.RecordError(err)
		ctxLogger.Error("Failed to release the lock", "error", err)
	}

	ctxLogger.Debug("LockExecuteAndReleaseWithRetries finished", "actionName", actionName, "duration", time.Since(start))

	return nil
}

// generate a random duration between minWait and maxWait to ensure instances unlock gradually
func lockWait(minWait time.Duration, maxWait time.Duration) time.Duration {
	return time.Duration(rand.Int63n(int64(maxWait-minWait)) + int64(minWait))
}

func isLockWithinInterval(lock *serverLock, maxInterval time.Duration) bool {
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

package serverlock

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

const (
	lockPrefix  = "server_lock:"
	lockTimeout = 24 * time.Hour * 30
)

type serverLockRemoteCache struct {
	remoteCache *remotecache.RemoteCache
	tracer      tracing.Tracer
	log         log.Logger
}

func (sl *serverLockRemoteCache) AcquireLock(ctx context.Context, serverLock *serverLock) (bool, error) {
	ctx, span := sl.tracer.Start(ctx, "serverLockRemoteCache.acquireLock")
	defer span.End()

	lockKey := prefixedLockKey(serverLock.OperationUID)

	// Convert serverLock to byte array
	serverLockBytes, err := json.Marshal(serverLock)
	if err != nil {
		return false, err
	}

	err = sl.remoteCache.Set(ctx, lockKey, serverLockBytes, lockTimeout)
	if err != nil {
		return false, err
	}

	return true, nil
}

func (sl *serverLockRemoteCache) AcquireForRelease(ctx context.Context, actionName string, maxInterval time.Duration) error {
	ctx, span := sl.tracer.Start(ctx, "serverLockRemoteCache.AcquireForRelease")
	defer span.End()

	lockKey := prefixedLockKey(actionName)

	// Check if the lock is already acquired
	val, err := sl.remoteCache.Get(ctx, lockKey)
	if err != nil {
		// If the lock is not found, acquire it
		if errors.Is(err, remotecache.ErrCacheItemNotFound) {
			serverLock := &serverLock{
				OperationUID:  actionName,
				Version:       0,
				LastExecution: time.Now().Unix(),
			}
			_, err := sl.AcquireLock(ctx, serverLock)
			return err
		}
		// If there is another error, return it
		return err
	}

	// If the lock is found, check if it is within the maxInterval
	serverLock := &serverLock{}
	if err := json.Unmarshal(val, serverLock); err != nil {
		return err
	}

	if isLockWithinInterval(serverLock, maxInterval) {
		return &ServerLockExistsError{actionName: actionName}
	}

	// If the lock is timeouted, acquire it
	_, err = sl.AcquireLock(ctx, serverLock)
	return err
}

func (sl *serverLockRemoteCache) GetOrCreate(ctx context.Context, actionName string) (*serverLock, error) {
	ctx, span := sl.tracer.Start(ctx, "serverLockRemoteCache.getOrCreate")
	defer span.End()

	lockKey := prefixedLockKey(actionName)

	// Check if the lock is already acquired
	val, err := sl.remoteCache.Get(ctx, lockKey)
	if err != nil {
		// If the lock is not found, acquire it
		if errors.Is(err, remotecache.ErrCacheItemNotFound) {
			serverLock := &serverLock{
				OperationUID:  actionName,
				Version:       0,
				LastExecution: time.Now().Unix(),
			}
			_, err := sl.AcquireLock(ctx, serverLock)
			if err != nil {
				return nil, err
			}
			return serverLock, nil
		}
		// If there is another error, return it
		return nil, err
	}

	serverLock := &serverLock{}
	if err := json.Unmarshal(val, serverLock); err != nil {
		return nil, err
	}

	return serverLock, err
}

// releaseLock will delete the row at the database. This is only intended to be used within the scope of LockExecuteAndRelease
// method, but not as to manually release a Lock
func (sl *serverLockRemoteCache) ReleaseLock(ctx context.Context, actionName string) error {
	ctx, span := sl.tracer.Start(ctx, "serverLockRemoteCache.releaseLock")
	defer span.End()

	lockKey := prefixedLockKey(actionName)

	err := sl.remoteCache.Delete(ctx, lockKey)
	return err
}

func prefixedLockKey(actionName string) string {
	lockKey := lockPrefix + actionName
	return lockKey
}

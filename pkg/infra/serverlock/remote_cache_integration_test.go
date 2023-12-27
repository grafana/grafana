package serverlock

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

func TestIntegrationRedisCacheStorage(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	operationUID := "test-operation-release"

	t.Run("create lock and then release it", func(t *testing.T) {
		remoteCache := remotecache.CreateTestRedisCacheStorage(t)
		sl := createTestRedisServerLock(remoteCache)
		duration := time.Hour * 5

		err := sl.AcquireForRelease(context.Background(), operationUID, duration)
		require.NoError(t, err)

		err = sl.ReleaseLock(context.Background(), operationUID)
		require.NoError(t, err)

		// and now we can acquire it again
		err2 := sl.AcquireForRelease(context.Background(), operationUID, duration)
		require.NoError(t, err2)

		err = sl.ReleaseLock(context.Background(), operationUID)
		require.NoError(t, err)
	})

	t.Run("try to acquire a lock which is already locked, get error", func(t *testing.T) {
		remoteCache := remotecache.CreateTestRedisCacheStorage(t)
		sl := createTestRedisServerLock(remoteCache)
		duration := time.Hour * 5

		err := sl.AcquireForRelease(context.Background(), operationUID, duration)
		require.NoError(t, err)

		err2 := sl.AcquireForRelease(context.Background(), operationUID, duration)
		require.Error(t, err2, "We should expect an error when trying to get the second lock")
		require.Equal(t, "there is already a lock for this actionName: "+operationUID, err2.Error())

		err3 := sl.ReleaseLock(context.Background(), operationUID)
		require.NoError(t, err3)
	})

	t.Run("lock already exists but is timeouted", func(t *testing.T) {
		remoteCache := remotecache.CreateTestRedisCacheStorage(t)
		sl := createTestRedisServerLock(remoteCache)
		pastLastExec := time.Now().Add(-time.Hour).Unix()
		lock := serverLock{
			OperationUID:  operationUID,
			LastExecution: pastLastExec,
		}

		marshalled, err := json.Marshal(lock)
		require.NoError(t, err)

		err = remoteCache.Set(context.Background(), prefixedLockKey(operationUID), marshalled, time.Hour*24)
		require.NoError(t, err)

		require.NoError(t, err)
		duration := time.Minute * 5

		err = sl.AcquireForRelease(context.Background(), operationUID, duration)
		require.NoError(t, err)

		val, err := remoteCache.Get(context.Background(), prefixedLockKey(operationUID))
		require.NoError(t, err)

		got := serverLock{}
		err = json.Unmarshal(val, &got)
		require.NoError(t, err)

		require.Equal(t, operationUID, got.OperationUID)
		require.True(t, got.LastExecution > pastLastExec, "%v should be greater than %v", got, pastLastExec)

		err3 := sl.ReleaseLock(context.Background(), operationUID)
		require.NoError(t, err3)
	})
}

func createTestRedisServerLock(remoteCache *remotecache.RemoteCache) *serverLockRemoteCache {
	sl := &serverLockRemoteCache{
		remoteCache: remoteCache,
		tracer:      tracing.InitializeTracerForTest(),
		log:         log.New("test-logger"),
	}
	return sl
}

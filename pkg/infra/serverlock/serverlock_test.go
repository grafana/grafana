package serverlock

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func createTestableServerLock(t *testing.T) *ServerLockService {
	t.Helper()

	store := db.InitTestDB(t)

	return &ServerLockService{
		SQLStore: store,
		tracer:   tracing.InitializeTracerForTest(),
		log:      log.New("test-logger"),
	}
}

func TestIntegrationServerLock(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	sl := createTestableServerLock(t)
	operationUID := "test-operation"

	first, err := sl.getOrCreate(context.Background(), operationUID)
	require.NoError(t, err)
	require.NotZero(t, first.Id)

	t.Run("trying to create three new row locks", func(t *testing.T) {
		expectedLastExecution := first.LastExecution
		var latest *serverLock

		for i := 0; i < 3; i++ {
			latest, err = sl.getOrCreate(context.Background(), operationUID)
			require.NoError(t, err)
			assert.Equal(t, first.OperationUID, operationUID)
			assert.Equal(t, first.Id, latest.Id)
		}

		assert.Equal(t,
			expectedLastExecution,
			latest.LastExecution,
			"latest execution should not have changed")
	})

	t.Run("create lock on first row", func(t *testing.T) {
		gotLock, err := sl.acquireLock(context.Background(), first)
		require.NoError(t, err)
		assert.True(t, gotLock)

		gotLock, err = sl.acquireLock(context.Background(), first)
		require.NoError(t, err)
		assert.False(t, gotLock)
	})
}

func TestIntegrationLockAndRelease(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	operationUID := "test-operation-release"

	t.Run("create lock and then release it", func(t *testing.T) {
		sl := createTestableServerLock(t)
		duration := time.Hour * 5

		err := sl.acquireForRelease(context.Background(), operationUID, duration)
		require.NoError(t, err)

		err = sl.releaseLock(context.Background(), operationUID)
		require.NoError(t, err)

		// and now we can acquire it again
		err2 := sl.acquireForRelease(context.Background(), operationUID, duration)
		require.NoError(t, err2)

		err = sl.releaseLock(context.Background(), operationUID)
		require.NoError(t, err)
	})

	t.Run("try to acquire a lock which is already locked, get error", func(t *testing.T) {
		sl := createTestableServerLock(t)
		duration := time.Hour * 5

		err := sl.acquireForRelease(context.Background(), operationUID, duration)
		require.NoError(t, err)

		err2 := sl.acquireForRelease(context.Background(), operationUID, duration)
		require.Error(t, err2, "We should expect an error when trying to get the second lock")
		require.Equal(t, "there is already a lock for this actionName: "+operationUID, err2.Error())

		err3 := sl.releaseLock(context.Background(), operationUID)
		require.NoError(t, err3)
	})

	t.Run("lock already exists but is timeouted", func(t *testing.T) {
		sl := createTestableServerLock(t)
		pastLastExec := time.Now().Add(-time.Hour).Unix()
		lock := serverLock{
			OperationUID:  operationUID,
			LastExecution: pastLastExec,
		}

		// inserting a row with lock in the past
		err := sl.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *db.Session) error {
			affectedRows, err := sess.Insert(&lock)
			require.NoError(t, err)
			require.Equal(t, int64(1), affectedRows)
			require.NotZero(t, lock.Id)
			return nil
		})
		require.NoError(t, err)
		duration := time.Minute * 5

		err = sl.acquireForRelease(context.Background(), operationUID, duration)
		require.NoError(t, err)

		//validate that the lock LastExecution was updated (at least different from the original)
		err = sl.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *db.Session) error {
			lockRows := []*serverLock{}
			err := sess.Where("operation_uid = ?", operationUID).Find(&lockRows)
			require.NoError(t, err)
			require.Equal(t, 1, len(lockRows))
			require.NotEqual(t, pastLastExec, lockRows[0].LastExecution)
			return nil
		})
		require.NoError(t, err)

		err3 := sl.releaseLock(context.Background(), operationUID)
		require.NoError(t, err3)
	})
}

package serverlock

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

func createTestableServerLock(t *testing.T) *ServerLockService {
	t.Helper()

	store := db.InitTestDB(t)

	return &ServerLockService{
		locker: &serverLockDB{
			SQLStore: store,
			tracer:   tracing.InitializeTracerForTest(),
			log:      log.New("test-logger"),
		},
		tracer: tracing.InitializeTracerForTest(),
		log:    log.New("test-logger"),
	}
}

func TestServerLock(t *testing.T) {
	sl := createTestableServerLock(t)
	operationUID := "test-operation"

	first, err := sl.locker.GetOrCreate(context.Background(), operationUID)
	require.NoError(t, err)

	t.Run("trying to create three new row locks", func(t *testing.T) {
		expectedLastExecution := first.LastExecution
		var latest *serverLock

		for i := 0; i < 3; i++ {
			latest, err = sl.locker.GetOrCreate(context.Background(), operationUID)
			require.NoError(t, err)
			assert.Equal(t, operationUID, first.OperationUID)
			assert.Equal(t, int64(1), first.Id)
		}

		assert.Equal(t,
			expectedLastExecution,
			latest.LastExecution,
			"latest execution should not have changed")
	})

	t.Run("create lock on first row", func(t *testing.T) {
		gotLock, err := sl.locker.AcquireLock(context.Background(), first)
		require.NoError(t, err)
		assert.True(t, gotLock)

		gotLock, err = sl.locker.AcquireLock(context.Background(), first)
		require.NoError(t, err)
		assert.False(t, gotLock)
	})
}

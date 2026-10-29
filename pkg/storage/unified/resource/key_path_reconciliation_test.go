package resource

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"testing/synctest"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/require"
)

type keyPathReconciliationLogger struct {
	logging.NoOpLogger
	successes atomic.Int32
	failures  atomic.Int32
}

func (l *keyPathReconciliationLogger) Info(string, ...any)  { l.successes.Add(1) }
func (l *keyPathReconciliationLogger) Error(string, ...any) { l.failures.Add(1) }

func TestKeyPathReconciliationRepeatsAfterCleanPass(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		logger := &keyPathReconciliationLogger{}
		backend := &kvStorageBackend{log: logger}
		var calls, pending atomic.Int32
		pending.Store(2*keyPathReconciliationBatchSize + 1)
		go backend.runKeyPathReconciliation(ctx, func(_ context.Context, batchSize int) (int, error) {
			calls.Add(1)
			count := min(pending.Load(), int32(batchSize))
			pending.Add(-count)
			return int(count), nil
		})
		synctest.Wait()
		require.EqualValues(t, 1, calls.Load(), "first batch runs immediately")
		require.Zero(t, logger.successes.Load())
		for range 3 {
			synctest.Sleep(keyPathReconciliationBatchWait)
		}
		require.Zero(t, pending.Load())
		require.EqualValues(t, 1, logger.successes.Load())

		pending.Store(1) // An old pod writes after the clean pass.
		synctest.Sleep(keyPathReconciliationInterval)
		require.Zero(t, pending.Load())
		require.EqualValues(t, 1, logger.successes.Load(), "repair is followed by a separate clean check")
		synctest.Sleep(keyPathReconciliationBatchWait)
		require.EqualValues(t, 2, logger.successes.Load())

		cancel()
		synctest.Wait()
		callsAtStop := calls.Load()
		synctest.Sleep(keyPathReconciliationInterval)
		require.Equal(t, callsAtStop, calls.Load())
	})
}

func TestKeyPathReconciliationRetriesFailures(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		logger := &keyPathReconciliationLogger{}
		backend := &kvStorageBackend{log: logger}
		var calls atomic.Int32
		go backend.runKeyPathReconciliation(ctx, func(context.Context, int) (int, error) {
			if calls.Add(1) == 1 {
				return 0, errors.New("database unavailable")
			}
			return 0, nil
		})
		synctest.Wait()
		require.EqualValues(t, 1, logger.failures.Load())
		require.Zero(t, logger.successes.Load())
		synctest.Sleep(keyPathReconciliationInterval)
		require.EqualValues(t, 2, calls.Load())
		require.EqualValues(t, 1, logger.successes.Load())
	})
}

func TestKeyPathReconciliationCancellation(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		logger := &keyPathReconciliationLogger{}
		backend := &kvStorageBackend{log: logger}
		go backend.runKeyPathReconciliation(ctx, func(ctx context.Context, _ int) (int, error) {
			<-ctx.Done()
			return 0, ctx.Err()
		})
		synctest.Wait()
		cancel()
		synctest.Wait()
		require.Zero(t, logger.failures.Load())
		require.Zero(t, logger.successes.Load())
	})
}

func TestKeyPathReconciliationTimeout(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		logger := &keyPathReconciliationLogger{}
		backend := &kvStorageBackend{log: logger}
		go backend.runKeyPathReconciliation(ctx, func(ctx context.Context, _ int) (int, error) {
			<-ctx.Done()
			return 0, ctx.Err()
		})
		synctest.Sleep(keyPathReconciliationTimeout)
		require.EqualValues(t, 1, logger.failures.Load())
		require.Zero(t, logger.successes.Load())
	})
}

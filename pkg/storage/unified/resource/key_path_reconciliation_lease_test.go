package resource

import (
	"context"
	"io"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
)

func TestKeyPathReconciliationWaitsForStartupMigrations(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		logger := &keyPathReconciliationLogger{}
		backend := newKeyPathReconciliationBackend(t, logger, nil)
		backend.gcGate = NewGCGate()
		var calls atomic.Int32
		go backend.runKeyPathReconciliation(ctx, func(context.Context, int) (int, error) {
			calls.Add(1)
			return 0, nil
		})
		synctest.Wait()
		synctest.Sleep(time.Minute)
		require.Zero(t, calls.Load())
		require.Zero(t, logger.successes.Load())

		backend.gcGate.Release()
		synctest.Wait()
		require.EqualValues(t, 1, calls.Load(), "first pass starts as soon as startup migrations finish")
		require.EqualValues(t, 1, logger.successes.Load())
	})
}

func TestKeyPathReconciliationStopsWhileWaitingForMigrations(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		logger := &keyPathReconciliationLogger{}
		backend := newKeyPathReconciliationBackend(t, logger, nil)
		backend.gcGate = NewGCGate()
		var calls atomic.Int32
		done := make(chan struct{})
		go func() {
			defer close(done)
			backend.runKeyPathReconciliation(ctx, func(context.Context, int) (int, error) {
				calls.Add(1)
				return 0, nil
			})
		}()
		synctest.Wait()
		cancel()
		<-done
		require.Zero(t, calls.Load())
		require.Zero(t, logger.successes.Load())
		require.Zero(t, logger.failures.Load())
	})
}

func TestKeyPathReconciliationContenderRepairsLateWrite(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		loggerA, loggerB := &keyPathReconciliationLogger{}, &keyPathReconciliationLogger{}
		a := newKeyPathReconciliationBackend(t, loggerA, nil)
		b := newKeyPathReconciliationBackend(t, loggerB, a.kv)
		var callsA, callsB, pending atomic.Int32
		finishCleanScan := make(chan struct{})
		go a.runKeyPathReconciliation(ctx, func(ctx context.Context, _ int) (int, error) {
			switch callsA.Add(1) {
			case 1:
				return 1, nil
			case 2:
				select {
				case <-finishCleanScan:
				case <-ctx.Done():
					return 0, ctx.Err()
				}
			}
			return 0, nil
		})
		synctest.Wait()
		synctest.Sleep(keyPathReconciliationBatchWait)
		require.EqualValues(t, 2, callsA.Load())

		// A has already observed a clean scan. B writes one last empty path,
		// restarts, and initially cannot acquire the lease still held by A.
		pending.Store(1)
		go b.runKeyPathReconciliation(ctx, func(context.Context, int) (int, error) {
			callsB.Add(1)
			return int(pending.Swap(0)), nil
		})
		synctest.Wait()
		require.Zero(t, callsB.Load())
		require.Zero(t, loggerB.successes.Load(), "lease contention is not a completed clean scan")
		require.Zero(t, loggerB.failures.Load(), "lease contention is expected")

		close(finishCleanScan)
		synctest.Wait()
		require.EqualValues(t, 1, loggerA.successes.Load())
		require.EqualValues(t, 1, pending.Load())
		synctest.Sleep(time.Minute - time.Second)
		require.Zero(t, callsB.Load())
		synctest.Sleep(time.Second)
		require.EqualValues(t, 1, callsB.Load())
		require.Zero(t, pending.Load(), "B retries after one minute rather than waiting an hour")
		synctest.Sleep(keyPathReconciliationBatchWait)
		require.EqualValues(t, 1, loggerB.successes.Load())
	})
}

func TestKeyPathReconciliationReleasesLeaseOnShutdown(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctxA, cancelA := context.WithCancel(t.Context())
		defer cancelA()
		ctxB, cancelB := context.WithCancel(t.Context())
		defer cancelB()
		store := &keyPathBlockingReleaseKV{KV: setupBadgerKV(t), started: make(chan struct{}), proceed: make(chan struct{})}
		a := newKeyPathReconciliationBackend(t, &keyPathReconciliationLogger{}, store)
		a.cancel = cancelA
		loggerB := &keyPathReconciliationLogger{}
		b := newKeyPathReconciliationBackend(t, loggerB, a.kv)
		a.startKeyPathReconciliation(ctxA, func(ctx context.Context, _ int) (int, error) {
			<-ctx.Done()
			return 0, ctx.Err()
		})
		synctest.Wait()
		var callsB atomic.Int32
		go b.runKeyPathReconciliation(ctxB, func(context.Context, int) (int, error) {
			callsB.Add(1)
			return 0, nil
		})
		synctest.Wait()
		require.Zero(t, callsB.Load())
		stopped := make(chan error, 1)
		go func() { stopped <- a.Stop(t.Context()) }()
		<-store.started
		synctest.Wait()
		select {
		case err := <-stopped:
			t.Fatalf("Stop returned before lease cleanup completed: %v", err)
		default:
		}
		close(store.proceed)
		require.NoError(t, <-stopped)
		l, err := b.leaseManager.Acquire(t.Context(), keyPathReconciliationLeaseName)
		require.NoError(t, err, "another pod can acquire immediately after Stop returns")
		require.NoError(t, b.leaseManager.Release(t.Context(), l))
		synctest.Sleep(time.Minute)
		require.EqualValues(t, 1, callsB.Load())
		require.EqualValues(t, 1, loggerB.successes.Load())
	})
}

type keyPathBlockingReleaseKV struct {
	KV
	started chan struct{}
	proceed chan struct{}
	once    sync.Once
}

func (k *keyPathBlockingReleaseKV) Save(ctx context.Context, section, key string) (io.WriteCloser, error) {
	k.once.Do(func() { close(k.started) })
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-k.proceed:
		return k.KV.Save(ctx, section, key)
	}
}

func TestKeyPathReconciliationStopHonorsDeadline(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		store := &keyPathBlockingReleaseKV{KV: setupBadgerKV(t), started: make(chan struct{}), proceed: make(chan struct{})}
		backend := newKeyPathReconciliationBackend(t, &keyPathReconciliationLogger{}, store)
		backend.cancel = cancel
		backend.startKeyPathReconciliation(ctx, func(ctx context.Context, _ int) (int, error) {
			<-ctx.Done()
			return 0, ctx.Err()
		})
		synctest.Wait()
		stopCtx, cancelStop := context.WithTimeout(t.Context(), time.Second)
		defer cancelStop()
		stopped := make(chan error, 1)
		go func() { stopped <- backend.Stop(stopCtx) }()
		<-store.started
		synctest.Sleep(time.Second)
		require.ErrorIs(t, <-stopped, context.DeadlineExceeded)
		close(store.proceed)
		<-backend.keyPathReconciliationDone
	})
}

func TestKeyPathReconciliationRenewsLeaseAcrossBatches(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		logger := &keyPathReconciliationLogger{}
		a := newKeyPathReconciliationBackend(t, logger, nil)
		b := newKeyPathReconciliationBackend(t, &keyPathReconciliationLogger{}, a.kv)
		var finish atomic.Bool
		go a.runKeyPathReconciliation(ctx, func(context.Context, int) (int, error) {
			if finish.Load() {
				return 0, nil
			}
			return 1, nil
		})
		synctest.Wait()
		synctest.Sleep(2 * keyPathReconciliationLeaseTTL)
		_, err := b.leaseManager.Acquire(t.Context(), keyPathReconciliationLeaseName)
		require.ErrorIs(t, err, lease.ErrLeaseAlreadyHeld)
		finish.Store(true)
		synctest.Sleep(keyPathReconciliationBatchWait)
		require.EqualValues(t, 1, logger.successes.Load())
		l, err := b.leaseManager.Acquire(t.Context(), keyPathReconciliationLeaseName)
		require.NoError(t, err)
		require.NoError(t, b.leaseManager.Release(t.Context(), l))
	})
}

type keyPathRenewalConflictKV struct {
	KV
	conflict atomic.Bool
}

func (k *keyPathRenewalConflictKV) Batch(ctx context.Context, section string, ops []kv.BatchOp) error {
	if k.conflict.Load() {
		return kv.ErrKeyAlreadyExists
	}
	return k.KV.Batch(ctx, section, ops)
}

func TestKeyPathReconciliationCancelsBatchOnLeaseLoss(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		store := &keyPathRenewalConflictKV{KV: setupBadgerKV(t)}
		logger := &keyPathReconciliationLogger{}
		backend := newKeyPathReconciliationBackend(t, logger, store)
		var canceled atomic.Bool
		go backend.runKeyPathReconciliation(ctx, func(ctx context.Context, _ int) (int, error) {
			<-ctx.Done()
			canceled.Store(true)
			return 0, ctx.Err()
		})
		synctest.Wait()
		store.conflict.Store(true)
		synctest.Sleep(keyPathReconciliationLeaseTTL / 3)
		require.True(t, canceled.Load(), "losing the lease cancels the in-flight batch before its timeout")
		require.EqualValues(t, 1, logger.failures.Load())
		require.Zero(t, logger.successes.Load())
	})
}

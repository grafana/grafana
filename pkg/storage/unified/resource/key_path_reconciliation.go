package resource

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
)

const (
	keyPathReconciliationBatchSize     = 100
	keyPathReconciliationBatchWait     = time.Second
	keyPathReconciliationInterval      = time.Hour
	keyPathReconciliationRetryInterval = time.Minute
	keyPathReconciliationTimeout       = 30 * time.Second
	keyPathReconciliationLeaseName     = "key-path-reconciliation"
	keyPathReconciliationLeaseTTL      = time.Minute
)

func (k *kvStorageBackend) startKeyPathReconciliation(ctx context.Context, reconcile func(context.Context, int) (int, error)) {
	done := make(chan struct{})
	k.keyPathReconciliationDone = done
	go func() {
		defer close(done)
		k.runKeyPathReconciliation(ctx, reconcile)
	}()
}

func (k *kvStorageBackend) runKeyPathReconciliation(ctx context.Context, reconcile func(context.Context, int) (int, error)) {
	// Startup bulk migrations also update search rebuild markers.
	if !k.gcGate.Wait(ctx, ctx.Done()) {
		return
	}

	timer := time.NewTimer(0)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
		}

		processed, err := k.reconcileKeyPathsPass(ctx, reconcile)
		if ctx.Err() != nil {
			return
		}
		if err != nil {
			if errors.Is(err, lease.ErrLeaseAlreadyHeld) {
				k.log.Debug("Key path reconciliation is running on another instance; will retry")
			} else {
				k.log.Error("Key path reconciliation failed; will retry", "error", err, "processed_rows", processed)
			}
			// Contention is not a clean pass: this pod may be the last old writer
			// restarting, so it must retry rather than assume another pod finished.
			timer.Reset(keyPathReconciliationRetryInterval)
			continue
		}

		k.log.Info("Key path reconciliation succeeded; no missing key paths remain", "processed_rows", processed)
		timer.Reset(keyPathReconciliationInterval)
	}
}

func (k *kvStorageBackend) reconcileKeyPathsPass(ctx context.Context, reconcile func(context.Context, int) (int, error)) (processed int, err error) {
	acquireCtx, cancelAcquire := context.WithTimeout(ctx, keyPathReconciliationTimeout)
	l, err := k.leaseManager.Acquire(acquireCtx, keyPathReconciliationLeaseName, lease.WithTTL(keyPathReconciliationLeaseTTL), lease.WithAutoRenew())
	cancelAcquire()
	if err != nil {
		return 0, err
	}

	passCtx, cancelPass := context.WithCancelCause(ctx)
	watcherDone := make(chan struct{})
	go func() {
		defer close(watcherDone)
		select {
		case <-l.Lost():
			cancelPass(lease.ErrLeaseLost)
		case <-passCtx.Done():
		}
	}()
	defer func() {
		cancelPass(nil)
		<-watcherDone
		// Shutdown must still release the lease so a waiting pod can take over.
		releaseCtx, cancelRelease := context.WithTimeout(context.WithoutCancel(ctx), keyPathReconciliationTimeout)
		defer cancelRelease()
		if releaseErr := k.leaseManager.Release(releaseCtx, l); releaseErr != nil {
			err = errors.Join(err, fmt.Errorf("release key path reconciliation lease: %w", releaseErr))
		}
	}()

	for {
		if err := context.Cause(passCtx); err != nil {
			return processed, err
		}
		batchCtx, cancelBatch := context.WithTimeout(passCtx, keyPathReconciliationTimeout)
		count, err := reconcile(batchCtx, keyPathReconciliationBatchSize)
		cancelBatch()
		if err != nil {
			return processed, err
		}
		processed += count
		if count == 0 {
			return processed, nil
		}

		timer := time.NewTimer(keyPathReconciliationBatchWait)
		select {
		case <-passCtx.Done():
			timer.Stop()
			return processed, context.Cause(passCtx)
		case <-timer.C:
		}
	}
}

package resource

import (
	"context"
	"time"
)

const (
	keyPathReconciliationBatchSize     = 100
	keyPathReconciliationBatchWait     = time.Second
	keyPathReconciliationInterval      = time.Hour
	keyPathReconciliationRetryInterval = time.Minute
	keyPathReconciliationTimeout       = 30 * time.Second
)

func (k *kvStorageBackend) runKeyPathReconciliation(ctx context.Context, reconcile func(context.Context, int) (int, error)) {
	timer := time.NewTimer(0)
	defer timer.Stop()

	processed := 0
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
		}

		batchCtx, cancel := context.WithTimeout(ctx, keyPathReconciliationTimeout)
		count, err := reconcile(batchCtx, keyPathReconciliationBatchSize)
		cancel()
		if ctx.Err() != nil {
			return
		}
		if err != nil {
			k.log.Error("Key path reconciliation failed; will retry", "error", err, "processed_rows", processed)
			timer.Reset(keyPathReconciliationRetryInterval)
			continue
		}
		processed += count
		if count > 0 {
			timer.Reset(keyPathReconciliationBatchWait)
			continue
		}

		// A clean pass is not permanent: old pods can still write empty paths
		// until the rolling upgrade finishes.
		k.log.Info("Key path reconciliation succeeded; no missing key paths remain", "processed_rows", processed)
		processed = 0
		timer.Reset(keyPathReconciliationInterval)
	}
}

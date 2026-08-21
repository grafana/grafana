package resource

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
)

// The key_path reconciler backfills resource_history rows whose key_path column
// is empty. Such rows can exist after an HA rolling upgrade: the migration that
// backfills key_path and the code that populates it on write shipped together,
// so an old instance could write empty-key_path rows after a newer instance had
// already run the one-shot backfill. Rows with an empty key_path are invisible
// to the key-range scans used to read resources, so they must be repaired.
//
// This job derives the correct key_path from the legacy compatibility columns
// still present on resource_history and is a no-op once every row is populated.
//
// TODO: remove this once every supported Grafana version populates key_path on
// write (i.e. once the release that introduced key_path on write is EOL).
const (
	keyPathReconcileLeaseName = "keypath-reconcile"
	keyPathReconcileBatchSize = 1000
	// keyPathReconcileInterval re-runs the scan while holding the lease so that
	// rows written by a lingering old instance during a rolling upgrade are
	// caught after the initial pass. The scan is a cheap indexed no-op once
	// there are no empty key_path rows left.
	keyPathReconcileInterval  = 15 * time.Minute
	keyPathReconcileRetryWait = 1 * time.Minute
	keyPathReconcileLeaseTTL  = time.Minute
)

// keyPathBackfiller is implemented by KV stores that keep resource_history rows
// with a key_path column that can be left empty by older writers.
type keyPathBackfiller interface {
	ListEmptyKeyPaths(ctx context.Context, limit int) ([]kv.EmptyKeyPathRow, error)
	SetKeyPathIfEmpty(ctx context.Context, guid, keyPath string) (bool, error)
}

// ReconcileKeyPathsNow runs a single key_path backfill pass synchronously and
// returns the number of rows repaired. It takes no lease, so callers are
// responsible for coordination; the background reconciler handles that for the
// normal case. Returns 0, nil when the KV store has no key_path to reconcile.
func (k *kvStorageBackend) ReconcileKeyPathsNow(ctx context.Context) (int, error) {
	backfiller, ok := k.kv.(keyPathBackfiller)
	if !ok {
		return 0, nil
	}
	return k.backfillEmptyKeyPaths(ctx, backfiller)
}

// startKeyPathReconciler starts the background key_path reconciler if the KV
// store supports it. Callers must ensure leases are enabled before calling.
func (k *kvStorageBackend) startKeyPathReconciler(ctx context.Context) {
	backfiller, ok := k.kv.(keyPathBackfiller)
	if !ok {
		k.log.Debug("kv store does not support key_path backfill; reconciler disabled")
		return
	}
	go k.runKeyPathReconciler(ctx, backfiller)
}

// runKeyPathReconciler acquires the reconcile lease so that a single instance
// runs the backfill across an HA deployment. If another instance holds the
// lease, it retries later so a dead holder is eventually replaced.
func (k *kvStorageBackend) runKeyPathReconciler(ctx context.Context, backfiller keyPathBackfiller) {
	for {
		if ctx.Err() != nil {
			return
		}

		l, err := k.leaseManager.Acquire(ctx, keyPathReconcileLeaseName,
			lease.WithTTL(keyPathReconcileLeaseTTL), lease.WithAutoRenew())
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			if !errors.Is(err, lease.ErrLeaseAlreadyHeld) {
				k.log.Warn("failed to acquire key_path reconcile lease", "error", err)
			}
			if !sleepCtx(ctx, keyPathReconcileRetryWait) {
				return
			}
			continue
		}

		k.reconcileKeyPathsWhileLeaseHeld(ctx, l, backfiller)

		if rerr := k.leaseManager.Release(ctx, l); rerr != nil && !errors.Is(rerr, lease.ErrLeaseLost) {
			k.log.Debug("failed to release key_path reconcile lease", "error", rerr)
		}
	}
}

// reconcileKeyPathsWhileLeaseHeld runs backfill passes until the lease is lost
// or the context is cancelled.
func (k *kvStorageBackend) reconcileKeyPathsWhileLeaseHeld(ctx context.Context, l *lease.Lease, backfiller keyPathBackfiller) {
	ticker := time.NewTicker(keyPathReconcileInterval)
	defer ticker.Stop()

	for {
		fixed, err := k.backfillEmptyKeyPaths(ctx, backfiller)
		if err != nil {
			k.log.Warn("key_path reconcile pass failed", "fixed", fixed, "error", err)
		} else if fixed > 0 {
			k.log.Info("key_path reconcile backfilled rows", "fixed", fixed)
		}

		select {
		case <-ctx.Done():
			return
		case <-l.Lost():
			return
		case <-ticker.C:
		}
	}
}

// backfillEmptyKeyPaths repairs every resource_history row with an empty
// key_path, in batches, and returns the number of rows fixed.
func (k *kvStorageBackend) backfillEmptyKeyPaths(ctx context.Context, backfiller keyPathBackfiller) (int, error) {
	total := 0
	for {
		if ctx.Err() != nil {
			return total, ctx.Err()
		}

		rows, err := backfiller.ListEmptyKeyPaths(ctx, keyPathReconcileBatchSize)
		if err != nil {
			return total, err
		}
		if len(rows) == 0 {
			return total, nil
		}

		fixed := 0
		for _, row := range rows {
			keyPath, err := keyPathForEmptyRow(row)
			if err != nil {
				// A row we cannot reconstruct must not stall the whole pass; log
				// it and move on. It will be retried on the next pass.
				k.log.Warn("cannot reconstruct key_path for resource_history row", "guid", row.GUID, "error", err)
				continue
			}
			ok, err := backfiller.SetKeyPathIfEmpty(ctx, row.GUID, keyPath)
			if err != nil {
				return total, err
			}
			if ok {
				fixed++
				total++
			}
		}

		if fixed == 0 {
			// No row in this batch could be repaired (all unreconstructable or
			// already claimed by a concurrent writer). Stop rather than loop
			// forever on the same batch.
			return total, fmt.Errorf("key_path reconcile made no progress on a batch of %d rows", len(rows))
		}
		if len(rows) < keyPathReconcileBatchSize {
			return total, nil
		}
	}
}

// keyPathForEmptyRow reconstructs the key_path for a resource_history row from
// its legacy compatibility columns, matching what the write path produces.
func keyPathForEmptyRow(row kv.EmptyKeyPathRow) (string, error) {
	action, err := kv.DataActionFromLegacy(row.Action)
	if err != nil {
		return "", err
	}
	dk := kv.DataKey{
		Group:     row.Group,
		Resource:  row.Resource,
		Namespace: row.Namespace,
		Name:      row.Name,
		// resource_version is stored as a microsecond RV; key_path uses the
		// snowflake encoding, matching the write path.
		ResourceVersion: ToSnowflakeRV(row.ResourceVersion),
		Action:          action,
		Folder:          row.Folder,
	}
	return kv.DataSection + "/" + dk.String(), nil
}

// sleepCtx waits for d or until ctx is cancelled. It reports whether the full
// duration elapsed (true) rather than the context being cancelled (false).
func sleepCtx(ctx context.Context, d time.Duration) bool {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

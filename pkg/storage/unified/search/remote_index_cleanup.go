package search

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"sort"
	"sync"
	"time"

	"github.com/Masterminds/semver"
	"github.com/oklog/ulid/v2"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// snapshotCleanupStatus labels for the index_server_snapshot_cleanups_total counter.
// One increment per (namespace, outcome) tuple.
const (
	snapshotCleanupStatusSuccess      = "success"
	snapshotCleanupStatusError        = "error"
	snapshotCleanupStatusSkipLockHeld = "skip_lock_held"
	snapshotCleanupStatusSkipUnowned  = "skip_unowned"
)

// snapshotDeletedKind labels for the index_server_snapshot_deleted_total counter.
const (
	snapshotDeletedKindSnapshot   = "snapshot"
	snapshotDeletedKindIncomplete = "incomplete"
)

// cleanupIncompleteUploadsMinAge is the minimum age of a partial upload prefix
// before CleanupIncompleteUploads will delete it. Set generously above the
// realistic upper bound for snapshot upload duration so a slow but live upload
// is never killed mid-flight by cleanup.
const cleanupIncompleteUploadsMinAge = 24 * time.Hour

// errCleanupLockLost is used as the cancellation cause for the per-namespace
// context when the cleanup lock's Lost() channel fires. Surfacing it via
// context.Cause lets the namespace loop tell "parent shutdown" apart from
// "lock lost" after the fact, without an extra channel.
var errCleanupLockLost = errors.New("cleanup lock lost")

// cleanupSnapshotsPeriodically runs runCleanup on a fixed CleanupInterval, with
// a uniformly jittered initial delay in [0, CleanupInterval). The jitter spreads
// the first cleanup pass across replicas deployed together so they don't all
// hammer the bucket on the same 6h boundary, and brings the average first-run
// latency down from one full interval to half.
func (b *bleveBackend) cleanupSnapshotsPeriodically(ctx context.Context) {
	defer b.bgTasksWg.Done()

	interval := b.opts.Snapshot.CleanupInterval
	if interval <= 0 {
		// Caller (NewBleveBackend) only starts this goroutine when CleanupInterval > 0.
		return
	}

	initialDelay := time.Duration(rand.Int64N(int64(interval)))
	select {
	case <-ctx.Done():
		return
	case <-time.After(initialDelay):
	}

	b.runCleanup(ctx)

	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			b.runCleanup(ctx)
		}
	}
}

// runCleanup lists every namespace currently holding remote snapshots and runs
// runNamespaceCleanup against each. Namespace order is randomised so two
// replicas sharing ownership are unlikely to contend on the same namespace's
// cleanup lock at the same instant.
func (b *bleveBackend) runCleanup(ctx context.Context) {
	store := b.opts.Snapshot.Store
	namespaces, err := store.ListNamespaces(ctx)
	if err != nil {
		// We can't attribute this error to any single namespace, so it shows up
		// as a single "error" cleanup. Logged at warn so operators see it.
		b.recordSnapshotCleanupStatus(snapshotCleanupStatusError)
		b.log.Warn("listing namespaces for snapshot cleanup", "err", err)
		return
	}
	rand.Shuffle(len(namespaces), func(i, j int) {
		namespaces[i], namespaces[j] = namespaces[j], namespaces[i]
	})
	for _, ns := range namespaces {
		if ctx.Err() != nil {
			return
		}
		b.runNamespaceCleanup(ctx, ns)
	}
}

// runNamespaceCleanup applies the retention rules to every resource under one
// namespace. Errors in one namespace must not abort the rest of the cleanup
// pass, so all error paths return without panicking.
func (b *bleveBackend) runNamespaceCleanup(ctx context.Context, namespace string) {
	store := b.opts.Snapshot.Store
	logger := b.log.New("namespace", namespace)

	// Ownership is checked at namespace granularity. The production OwnsIndex
	// implementation hashes on Namespace alone, so calling it with an empty
	// Group/Resource is the contract. A future change to that semantics will
	// trip the assertion in Test_RunCleanup_OwnershipFilter_NamespaceLevel.
	owned, err := b.ownsIndexFn(resource.NamespacedResource{Namespace: namespace})
	if err != nil {
		b.recordSnapshotCleanupStatus(snapshotCleanupStatusError)
		logger.Warn("ownership check failed during cleanup", "err", err)
		return
	}
	if !owned {
		b.recordSnapshotCleanupStatus(snapshotCleanupStatusSkipUnowned)
		return
	}

	lock, err := store.LockNamespaceForCleanup(ctx, namespace)
	if errors.Is(err, errLockHeld) {
		b.recordSnapshotCleanupStatus(snapshotCleanupStatusSkipLockHeld)
		return
	}
	if err != nil {
		b.recordSnapshotCleanupStatus(snapshotCleanupStatusError)
		logger.Warn("acquiring cleanup lock", "err", err)
		return
	}
	// Tie a per-namespace context to the cleanup lock: if the lock is lost
	// mid-run, cancel the context so any in-flight bucket operation
	// (List/Delete) aborts immediately rather than waiting for the next
	// resource boundary. The cause carries the reason so the post-loop check
	// can distinguish lock loss from parent shutdown.
	nsCtx, cancelNs := context.WithCancelCause(ctx)
	var watcher sync.WaitGroup
	watcher.Go(func() {
		select {
		case <-lock.Lost():
			cancelNs(errCleanupLockLost)
		case <-nsCtx.Done():
		}
	})
	// Order matters: cancel + wait for the watcher first, so it can't fire
	// against a stale lock; then release the lock.
	defer func() {
		cancelNs(nil)
		watcher.Wait()
		if releaseErr := lock.Release(); releaseErr != nil {
			logger.Warn("releasing cleanup lock", "err", releaseErr)
		}
	}()

	resources, err := store.ListNamespaceIndexes(nsCtx, namespace)
	if err != nil {
		b.recordSnapshotCleanupStatus(snapshotCleanupStatusError)
		logger.Warn("listing namespace indexes", "err", err)
		return
	}
	// Resource order is randomised so a single misbehaving resource (panic,
	// slow listing, lock loss before this point in the run) doesn't permanently
	// starve the resources after it. Unlike namespace shuffling above, this is
	// not about cross-replica contention — we hold the cleanup lock here, so no
	// other replica is processing this namespace.
	rand.Shuffle(len(resources), func(i, j int) {
		resources[i], resources[j] = resources[j], resources[i]
	})

	hadResourceError := false
	for _, res := range resources {
		// nsCtx covers both cancellation paths: lock loss (cause =
		// errCleanupLockLost) and parent shutdown (parent ctx cancelled,
		// propagated to nsCtx). The post-loop block decides which it was.
		if nsCtx.Err() != nil {
			break
		}
		if err := b.runResourceCleanup(nsCtx, res, logger); err != nil {
			if errors.Is(err, context.Canceled) {
				// Cancellation propagated from lock loss or parent shutdown;
				// not a resource-level failure.
				break
			}
			hadResourceError = true
			logger.Warn("resource cleanup failed", "resource", res, "err", err)
		}
	}

	if errors.Is(context.Cause(nsCtx), errCleanupLockLost) {
		logger.Warn("cleanup lock lost mid-run, aborted namespace")
		b.recordSnapshotCleanupStatus(snapshotCleanupStatusError)
		return
	}
	if ctx.Err() != nil {
		return
	}
	if hadResourceError {
		b.recordSnapshotCleanupStatus(snapshotCleanupStatusError)
		return
	}
	b.recordSnapshotCleanupStatus(snapshotCleanupStatusSuccess)
}

// runResourceCleanup applies the retention rules to one resource and sweeps any
// stale partial uploads. Returns the first error encountered; per-snapshot
// delete failures are logged but do not abort the resource (best effort).
func (b *bleveBackend) runResourceCleanup(ctx context.Context, res resource.NamespacedResource, logger log.Logger) error {
	store := b.opts.Snapshot.Store

	metas, err := store.ListIndexes(ctx, res)
	if err != nil {
		return fmt.Errorf("listing snapshots: %w", err)
	}

	toDelete := selectSnapshotsToDelete(metas, time.Now(), b.opts.Snapshot.MaxIndexAge, b.opts.Snapshot.CleanupGracePeriod)
	for _, key := range toDelete {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if err := store.DeleteIndex(ctx, res, key); err != nil {
			logger.Warn("deleting snapshot", "resource", res, "snapshot", key.String(), "err", err)
			continue
		}
		b.recordSnapshotDeleted(snapshotDeletedKindSnapshot)
	}

	cleaned, err := store.CleanupIncompleteUploads(ctx, res, cleanupIncompleteUploadsMinAge)
	if err != nil {
		return fmt.Errorf("cleaning up incomplete uploads: %w", err)
	}
	for range cleaned {
		b.recordSnapshotDeleted(snapshotDeletedKindIncomplete)
	}

	return nil
}

// selectSnapshotsToDelete applies the retention policy and returns the keys
// that should be deleted. Two independent rules; a snapshot is deletable if
// either fires:
//
//	A. Age cutoff: anything older than maxAge, regardless of group/successor.
//	B. Superseded with stable replacement: within a Grafana-version group, all
//	   snapshots except the newest are deletable once the newest has lived
//	   beyond gracePeriod.
//
// Snapshots with an unparseable GrafanaBuildVersion are excluded from any
// version group; rule A still applies, but otherwise they are left untouched.
// CleanupIncompleteUploads does NOT pick them up — it only targets prefixes
// with missing or syntactically invalid meta.json, and an unparseable version
// string lives inside a structurally valid manifest. Rule A's age cutoff is
// therefore the only mechanism that bounds their lifetime.
//
// The function is deliberately pure (no I/O, no metrics, no clock) to make
// retention semantics directly unit-testable.
func selectSnapshotsToDelete(metas map[ulid.ULID]*IndexMeta, now time.Time, maxAge, gracePeriod time.Duration) []ulid.ULID {
	type entry struct {
		key  ulid.ULID
		meta *IndexMeta
		v    *semver.Version
	}

	var toDelete []ulid.ULID
	groups := map[string][]entry{}

	for k, m := range metas {
		// Rule A first — applies regardless of version parseability.
		if maxAge > 0 && now.Sub(m.UploadTimestamp) > maxAge {
			toDelete = append(toDelete, k)
			continue
		}
		v, err := semver.NewVersion(m.GrafanaBuildVersion)
		if err != nil {
			continue
		}
		// Group by normalised version string so "11.5.0" and "v11.5.0" land in
		// the same bucket.
		groups[v.String()] = append(groups[v.String()], entry{key: k, meta: m, v: v})
	}

	for _, g := range groups {
		// Newest first: highest LatestResourceVersion wins, ties broken by
		// UploadTimestamp desc. Mirrors download-side selection so cleanup keeps
		// what the download path would prefer.
		sort.Slice(g, func(i, j int) bool {
			if g[i].meta.LatestResourceVersion != g[j].meta.LatestResourceVersion {
				return g[i].meta.LatestResourceVersion > g[j].meta.LatestResourceVersion
			}
			return g[i].meta.UploadTimestamp.After(g[j].meta.UploadTimestamp)
		})

		if len(g) <= 1 {
			continue
		}
		if now.Sub(g[0].meta.UploadTimestamp) < gracePeriod {
			// Newest in group hasn't stabilised yet — keep its predecessors so
			// in-flight downloaders that picked an older one can still find it.
			continue
		}
		for _, e := range g[1:] {
			toDelete = append(toDelete, e.key)
		}
	}

	return toDelete
}

func (b *bleveBackend) recordSnapshotCleanupStatus(status string) {
	if b.indexMetrics == nil {
		return
	}
	b.indexMetrics.IndexSnapshotCleanups.WithLabelValues(status).Inc()
}

func (b *bleveBackend) recordSnapshotDeleted(kind string) {
	if b.indexMetrics == nil {
		return
	}
	b.indexMetrics.IndexSnapshotDeleted.WithLabelValues(kind).Inc()
}

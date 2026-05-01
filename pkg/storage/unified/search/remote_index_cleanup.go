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
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// snapshotNamespaceCleanupStatus values are used for namespace cleanup logs,
// spans, and the index_server_snapshot_namespace_cleanups_total counter.
// Canceled is intentionally not recorded in the counter because it usually means shutdown.
const (
	snapshotNamespaceCleanupStatusSuccess      = "success"
	snapshotNamespaceCleanupStatusError        = "error"
	snapshotNamespaceCleanupStatusSkipLockHeld = "skip_lock_held"
	snapshotNamespaceCleanupStatusSkipUnowned  = "skip_unowned"
	snapshotNamespaceCleanupStatusCanceled     = "canceled"
)

// snapshotDeleteOutcome labels for the index_server_snapshot_deleted_total
// counter. Cleaned-up incomplete-upload prefixes are tracked in a separate
// metric (IndexSnapshotIncompleteUploadsCleaned) since they have no
// outcome=error series — CleanupIncompleteUploads short-circuits on internal
// errors and only reports successful prefix deletes.
const (
	snapshotDeleteOutcomeSuccess = "success"
	snapshotDeleteOutcomeError   = "error"
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

	// Caller (NewBleveBackend) only starts this goroutine when CleanupInterval > 0.
	interval := b.opts.Snapshot.CleanupInterval
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
	ctx, span := tracer.Start(ctx, "search.remote_index_snapshot.cleanup")
	start := time.Now()
	b.log.Info("Remote index snapshot cleanup started")
	defer span.End()

	store := b.opts.Snapshot.Store
	namespaces, err := store.ListNamespaces(ctx)
	if err != nil {
		// We can't attribute this error to any single namespace, so it shows up
		// as a single "error" cleanup. Logged at warn so operators see it.
		b.recordSnapshotNamespaceCleanupStatus(snapshotNamespaceCleanupStatusError)
		span.SetAttributes(attribute.String("outcome", snapshotNamespaceCleanupStatusError))
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		b.log.Warn("Remote index snapshot cleanup failed", "elapsed", time.Since(start), "err", err)
		return
	}
	span.SetAttributes(attribute.Int("namespace_count", len(namespaces)))
	rand.Shuffle(len(namespaces), func(i, j int) {
		namespaces[i], namespaces[j] = namespaces[j], namespaces[i]
	})
	hadNamespaceError := false
	for _, ns := range namespaces {
		if ctx.Err() != nil {
			span.SetAttributes(attribute.String("outcome", snapshotNamespaceCleanupStatusCanceled))
			b.log.Info("Remote index snapshot cleanup completed",
				"elapsed", time.Since(start),
				"outcome", snapshotNamespaceCleanupStatusCanceled,
			)
			return
		}

		outcome, err := b.runNamespaceCleanup(ctx, ns)
		// Cancellation usually means shutdown; keep it out of the namespace outcome metric.
		if outcome != snapshotNamespaceCleanupStatusCanceled {
			b.recordSnapshotNamespaceCleanupStatus(outcome)
		}
		if err != nil {
			hadNamespaceError = true
			continue
		}
	}
	if hadNamespaceError {
		err := fmt.Errorf("one or more namespace cleanups failed")
		span.SetAttributes(attribute.String("outcome", snapshotNamespaceCleanupStatusError))
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		b.log.Warn("Remote index snapshot cleanup failed", "elapsed", time.Since(start), "err", err)
		return
	}
	span.SetAttributes(attribute.String("outcome", snapshotNamespaceCleanupStatusSuccess))
	b.log.Info("Remote index snapshot cleanup completed",
		"elapsed", time.Since(start),
		"outcome", snapshotNamespaceCleanupStatusSuccess,
	)
}

// runNamespaceCleanup applies the retention rules to every resource under one
// namespace. Errors in one namespace must not abort the rest of the cleanup
// pass, so all error paths return without panicking.
func (b *bleveBackend) runNamespaceCleanup(ctx context.Context, namespace string) (outcome string, retErr error) {
	store := b.opts.Snapshot.Store
	nsLogger := b.log.New("namespace", namespace)
	ctx, span := tracer.Start(ctx, "search.remote_index_snapshot.namespace_cleanup",
		oteltrace.WithAttributes(attribute.String("namespace", namespace)),
	)
	start := time.Now()

	nsLogger.Info("Remote index snapshot namespace cleanup started")
	defer func() {
		span.SetAttributes(attribute.String("outcome", outcome))
		if retErr != nil {
			span.RecordError(retErr)
			span.SetStatus(codes.Error, retErr.Error())
			nsLogger.Warn("Remote index snapshot namespace cleanup failed", "elapsed", time.Since(start), "outcome", outcome, "err", retErr)
		} else {
			nsLogger.Info("Remote index snapshot namespace cleanup completed", "elapsed", time.Since(start), "outcome", outcome)
		}
		span.End()
	}()

	// Ownership is checked at namespace granularity. The production OwnsIndex
	// implementation hashes on Namespace alone, so calling it with an empty
	// Group/Resource is the contract. A future change to that semantics will
	// trip the assertion in TestRunCleanup_OwnershipFilter_NamespaceLevel.
	owned, err := b.ownsIndexFn(resource.NamespacedResource{Namespace: namespace})
	if err != nil {
		return snapshotNamespaceCleanupStatusError, fmt.Errorf("ownership check failed during cleanup: %w", err)
	}
	if !owned {
		return snapshotNamespaceCleanupStatusSkipUnowned, nil
	}

	lockAttrs := []attribute.KeyValue{
		attribute.String("lock_scope", "cleanup"),
	}
	span.AddEvent("snapshot.lock.acquire.started", oteltrace.WithAttributes(lockAttrs...))
	lock, err := store.LockNamespaceForCleanup(ctx, namespace)
	if errors.Is(err, errLockHeld) {
		span.AddEvent("snapshot.lock.acquire.skipped", oteltrace.WithAttributes(
			append(lockAttrs, attribute.String("reason", "lock_held"))...,
		))
		return snapshotNamespaceCleanupStatusSkipLockHeld, nil
	}
	if err != nil {
		span.AddEvent("snapshot.lock.acquire.failed", oteltrace.WithAttributes(lockAttrs...))
		return snapshotNamespaceCleanupStatusError, fmt.Errorf("acquiring cleanup lock: %w", err)
	}
	span.AddEvent("snapshot.lock.acquire.completed", oteltrace.WithAttributes(lockAttrs...))

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
		span.AddEvent("snapshot.lock.release.started", oteltrace.WithAttributes(lockAttrs...))
		if releaseErr := lock.Release(); releaseErr != nil {
			span.AddEvent("snapshot.lock.release.failed", oteltrace.WithAttributes(lockAttrs...))
			nsLogger.Warn("releasing cleanup lock", "err", releaseErr)
			return
		}
		span.AddEvent("snapshot.lock.release.completed", oteltrace.WithAttributes(lockAttrs...))
	}()

	resources, err := store.ListNamespaceIndexes(nsCtx, namespace)
	if err != nil {
		return snapshotNamespaceCleanupStatusError, fmt.Errorf("listing namespace indexes: %w", err)
	}

	// Resource order is randomized so a single misbehaving resource (panic,
	// slow listing, lock loss before this point in the run) doesn't permanently
	// starve the resources after it. Unlike namespace shuffling above, this is
	// not about cross-replica contention — we hold the cleanup lock here, so no
	// other replica is processing this namespace.
	rand.Shuffle(len(resources), func(i, j int) {
		resources[i], resources[j] = resources[j], resources[i]
	})

	var resourceErrs []error
	for _, res := range resources {
		// nsCtx covers both cancellation paths: lock loss (cause =
		// errCleanupLockLost) and parent shutdown (parent ctx cancelled,
		// propagated to nsCtx). The post-loop block decides which it was.
		if nsCtx.Err() != nil {
			break
		}
		if err := b.runResourceCleanup(nsCtx, res, nsLogger); err != nil {
			if errors.Is(err, context.Canceled) {
				// Cancellation propagated from lock loss or parent shutdown;
				// not a resource-level failure.
				break
			}
			resourceErrs = append(resourceErrs, err)
			nsLogger.Warn("resource cleanup failed", "resource", res, "err", err)
		}
	}

	if errors.Is(context.Cause(nsCtx), errCleanupLockLost) {
		return snapshotNamespaceCleanupStatusError, errCleanupLockLost
	}
	if ctx.Err() != nil {
		return snapshotNamespaceCleanupStatusCanceled, nil
	}
	if len(resourceErrs) > 0 {
		return snapshotNamespaceCleanupStatusError, fmt.Errorf("resource cleanup failed: %w", errors.Join(resourceErrs...))
	}
	return snapshotNamespaceCleanupStatusSuccess, nil
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
	deleteFailures := 0
	for _, key := range toDelete {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if err := store.DeleteIndex(ctx, res, key); err != nil {
			logger.Warn("deleting index snapshot", "resource", res, "snapshot", key.String(), "err", err)
			b.recordSnapshotDeleted(snapshotDeleteOutcomeError)
			deleteFailures++
			continue
		}
		logger.Info("deleted index snapshot", "resource", res, "snapshot", key.String(), "uploaded", metas[key].UploadTimestamp, "age", time.Since(metas[key].UploadTimestamp))
		b.recordSnapshotDeleted(snapshotDeleteOutcomeSuccess)
	}

	// CleanupIncompleteUploads returns a partial cleaned count even on error;
	// record successes before checking the error so metrics don't undercount
	// on transient bucket failures. Treated symmetrically with the per-snapshot
	// delete loop above: log, flag, continue — don't short-circuit the resource.
	cleaned, incompleteErr := store.CleanupIncompleteUploads(ctx, res, cleanupIncompleteUploadsMinAge)
	for range cleaned {
		b.recordIncompleteUploadCleaned()
	}
	if incompleteErr != nil {
		logger.Warn("cleaning up incomplete uploads", "resource", res, "err", incompleteErr)
	}

	// Surface failures so the namespace-level cleanup status flips to "error"
	// instead of being recorded as success. Per-snapshot detail is already in
	// the metrics above; this is the aggregate signal.
	var errs []error
	if deleteFailures > 0 {
		errs = append(errs, fmt.Errorf("%d snapshot delete(s) failed", deleteFailures))
	}
	if incompleteErr != nil {
		errs = append(errs, fmt.Errorf("cleaning up incomplete uploads: %w", incompleteErr))
	}
	return errors.Join(errs...)
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
		version := v.String()
		groups[version] = append(groups[version], entry{key: k, meta: m, v: v})
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

func (b *bleveBackend) recordSnapshotNamespaceCleanupStatus(status string) {
	if b.indexMetrics == nil {
		return
	}
	b.indexMetrics.IndexSnapshotNamespaceCleanups.WithLabelValues(status).Inc()
}

func (b *bleveBackend) recordSnapshotDeleted(outcome string) {
	if b.indexMetrics == nil {
		return
	}
	b.indexMetrics.IndexSnapshotDeleted.WithLabelValues(outcome).Inc()
}

func (b *bleveBackend) recordIncompleteUploadCleaned() {
	if b.indexMetrics == nil {
		return
	}
	b.indexMetrics.IndexSnapshotIncompleteUploadsCleaned.Inc()
}

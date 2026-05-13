// Package reconciler keeps the vector index in sync with ongoing
// dashboard writes via a periodic reconciler that drains an in-memory
// dedup map keyed by (group, resource, namespace, name). Watch events
// and startupReconcile-listed events both feed the map; enqueue keeps
// only the highest RV per resource so a replayed older event can't
// overwrite a newer one before it's processed.
package reconciler

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

const DefaultInterval = time.Minute

// maxEventAttempts caps retries so a permanently broken dashboard
// can't wedge cursor advancement forever. ~5 minutes at the default
// poll interval — long enough to ride out transient Vertex hiccups.
const maxEventAttempts = 5

// defaultLockRetryInterval is how long Run waits between attempts to
// acquire the reconciler advisory lock when another replica holds it.
// The loser is idle anyway, so longer intervals reduce churn against
// postgres without delaying real work.
const defaultLockRetryInterval = 10 * time.Second

// startupBatchSize bounds the per-flush batch size during
// startupReconcile. When the listing iterator fills a batch to this
// cap, we flush it through processEvents, then resume listing. Keeps
// memory bounded over large catch-up windows. Package-level so tests
// can override.
var startupBatchSize = 1000

// pendingEvent flattens (group, resource, namespace, name) instead of
// holding a *resourcepb.ResourceKey because that type embeds a sync.Mutex
// (via protoimpl.MessageState), which `go vet`'s copylocks check rejects
// on the value-typed map entries we use.
type pendingEvent struct {
	action    resourcepb.WatchEvent_Type
	group     string
	resource  string
	namespace string
	name      string
	value     []byte
	rv        int64
	attempts  int
}

func pendingKey(group, resource, namespace, name string) string {
	return group + "/" + resource + "/" + namespace + "/" + name
}

// builderKey identifies a builder by both group and resource so the
// reconciler supports multiple builders sharing a group (or, in
// principle, the same resource name under different groups).
func builderKey(group, resource string) string {
	return group + "/" + resource
}

type Options struct {
	Storage           resource.StorageBackend
	VectorBackend     vector.VectorBackend
	BatchEmbedder     *embedder.BatchEmbedder
	Builders          []embed.Builder
	Interval          time.Duration
	LockRetryInterval time.Duration
}

// Reconciler keeps the vector index in sync with ongoing writes. The
// advisory lock is held for the pod's lifetime (acquired in Run), so
// only one replica processes the pending map at a time and bootstrap
// pagination doesn't ping-pong across replicas. Connection-bound pg
// session locks release naturally if the pod crashes.
type Reconciler struct {
	storage           resource.StorageBackend
	vectorBackend     vector.VectorBackend
	batchEmbedder     *embedder.BatchEmbedder
	builders          map[string]embed.Builder
	interval          time.Duration
	lockRetryInterval time.Duration
	log               log.Logger

	// broadcaster is attached after construction by the resource server,
	broadcaster resource.Broadcaster[*resource.WrittenEvent]

	pendingMu sync.Mutex
	pending   map[string]*pendingEvent
}

// New constructs the embedding reconciler.
// The caller is expected to attach a broadcaster via Reconciler.UseBroadcaster
// before calling Run; without one the reconciler runs in poll-only mode.
func New(opts Options) (*Reconciler, error) {
	builders := make(map[string]embed.Builder, len(opts.Builders))
	if len(opts.Builders) == 0 {
		return nil, fmt.Errorf("reconciler: no builders")
	}
	for _, b := range opts.Builders {
		k := builderKey(b.Group(), b.Resource())
		if _, dup := builders[k]; dup {
			return nil, fmt.Errorf("reconciler: duplicate builder for %s", k)
		}
		builders[k] = b
	}
	if opts.Interval <= 0 {
		opts.Interval = DefaultInterval
	}
	if opts.LockRetryInterval <= 0 {
		opts.LockRetryInterval = defaultLockRetryInterval
	}
	return &Reconciler{
		storage:           opts.Storage,
		vectorBackend:     opts.VectorBackend,
		batchEmbedder:     opts.BatchEmbedder,
		builders:          builders,
		interval:          opts.Interval,
		lockRetryInterval: opts.LockRetryInterval,
		log:               log.New("embeddings_reconciler"),
		pending:           make(map[string]*pendingEvent),
	}, nil
}

func (s *Reconciler) UseBroadcaster(b resource.Broadcaster[*resource.WrittenEvent]) {
	s.broadcaster = b
}

// enqueue keeps the highest RV per resource so older replayed events
// can't overwrite a newer one already pending.
func (s *Reconciler) enqueue(ev *pendingEvent) {
	if ev == nil || ev.namespace == "" {
		return
	}
	if _, ok := s.builders[builderKey(ev.group, ev.resource)]; !ok {
		return
	}
	k := pendingKey(ev.group, ev.resource, ev.namespace, ev.name)
	s.pendingMu.Lock()
	defer s.pendingMu.Unlock()
	if existing, ok := s.pending[k]; ok && existing.rv >= ev.rv {
		return
	}
	s.pending[k] = ev
}

func (s *Reconciler) drainPending() []*pendingEvent {
	s.pendingMu.Lock()
	defer s.pendingMu.Unlock()
	if len(s.pending) == 0 {
		return nil
	}
	out := make([]*pendingEvent, 0, len(s.pending))
	for _, ev := range s.pending {
		out = append(out, ev)
	}
	s.pending = make(map[string]*pendingEvent)
	return out
}

func (s *Reconciler) pendingLen() int {
	s.pendingMu.Lock()
	defer s.pendingMu.Unlock()
	return len(s.pending)
}

func (s *Reconciler) Run(ctx context.Context) error {
	resources := make([]string, 0, len(s.builders))
	for r := range s.builders {
		resources = append(resources, r)
	}
	s.log.Info("reconciler: starting",
		"model", s.batchEmbedder.Model(),
		"resources", resources,
		"interval", s.interval)

	release, err := s.acquireLockBlocking(ctx)
	if err != nil {
		return err
	}
	defer release()
	s.log.Info("reconciler: lock acquired; entering active state")

	// Subscribe before startupReconcile so events between the
	// startupReconcile snapshot and the subscription join can't slip through;
	// the broadcaster's replay buffer covers the brief overlap.
	if s.broadcaster != nil {
		ch, err := s.broadcaster.Subscribe(ctx, "embeddings-reconciler", "embeddings-reconciler")
		if err != nil {
			s.log.Error("reconciler: subscribe to write events", "err", err)
		} else if ch != nil {
			watchFinished := make(chan struct{})
			defer func() {
				<-watchFinished
				s.broadcaster.Unsubscribe(ch)
			}()
			go func() {
				defer close(watchFinished)
				s.consumeWatchEvents(ctx, ch)
			}()
			s.log.Info("reconciler: subscribed to write events broadcaster")
		}
	}

	s.startupReconcile(ctx)

	t := time.NewTicker(s.interval)
	defer t.Stop()

	// First cycle runs immediately so a freshly-started replica picks up
	// startupReconcile work without waiting a full poll interval.
	s.processPending(ctx)
	for {
		select {
		case <-ctx.Done():
			s.log.Info("reconciler: stopping", "reason", ctx.Err())
			return ctx.Err()
		case <-t.C:
			s.processPending(ctx)
		}
	}
}

// acquireLockBlocking retries TryAcquireReconcilerLock at lockRetryInterval
// until the lock is held or ctx is cancelled. The returned release is
// called from Run's defer so the lock survives for the pod's lifetime.
func (s *Reconciler) acquireLockBlocking(ctx context.Context) (func(), error) {
	for {
		release, acquired, err := s.vectorBackend.TryAcquireReconcilerLock(ctx)
		if err != nil {
			s.log.Warn("reconciler: acquire lock", "err", err)
		} else if acquired {
			return release, nil
		} else {
			s.log.Debug("reconciler: lock held elsewhere; will retry", "interval", s.lockRetryInterval)
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(s.lockRetryInterval):
		}
	}
}

func (s *Reconciler) consumeWatchEvents(ctx context.Context, ch <-chan *resource.WrittenEvent) {
	for {
		select {
		case <-ctx.Done():
			return
		case ev, ok := <-ch:
			if !ok {
				s.log.Warn("reconciler: watch channel closed")
				return
			}
			if ev == nil || ev.Key == nil {
				continue
			}
			s.enqueue(&pendingEvent{
				action:    ev.Type,
				group:     ev.Key.Group,
				resource:  ev.Key.Resource,
				namespace: ev.Key.Namespace,
				name:      ev.Key.Name,
				value:     ev.Value,
				rv:        ev.ResourceVersion,
			})
			s.log.Debug("reconciler: watch event enqueued",
				"namespace", ev.Key.Namespace,
				"name", ev.Key.Name,
				"action", ev.Type,
				"rv", ev.ResourceVersion)
		}
	}
}

// startupReconcile enqueues changes since the last processed RV.
func (s *Reconciler) startupReconcile(ctx context.Context) {
	sinceRv, err := s.vectorBackend.GetLatestRV(ctx)
	if err != nil {
		s.log.Error("reconciler: startupReconcile read checkpoint", "err", err)
		return
	}
	if sinceRv == 0 {
		s.log.Info("reconciler: startupReconcile skipped; cursor at 0, nothing to process")
		return
	}
	s.log.Info("reconciler: startupReconcile starting", "since_rv", sinceRv)

	for _, b := range s.builders {
		if ctx.Err() != nil {
			return
		}
		s.reconcileSince(ctx, b, sinceRv)
	}
	s.log.Info("reconciler: startupReconcile complete")
}

// reconcileSince walks ListModifiedSince and processes events in
// startup-sized batches. Bootstrap deliberately bypasses the shared
// pending map: a watch event with a higher RV landing mid-iteration
// would otherwise advance the cursor past iter events not yet yielded,
// which would then be filtered out as "already processed" — leaving
// those dashboards without their initial embedding.
//
// The cursor is pinned to the value read at startupReconcile and
// advanced once after all batches drain. Advancing per-batch would
// drop events on the real SQL backend: rows come back ORDER BY
// resource_version DESC, so the first batch holds the highest RVs,
// and advancing after it would push every later (lower-RV) batch
// below the freshly-bumped cursor — silently losing those resources.
//
// Watch events accumulate in the shared pending map while bootstrap
// runs and are picked up by the first processPending cycle in Run.
func (s *Reconciler) reconcileSince(ctx context.Context, builder embed.Builder, sinceRv int64) {
	logger := s.log.FromContext(ctx)
	key := resource.NamespacedResource{
		Group:    builder.Group(),
		Resource: builder.Resource(),
		// Empty namespace → cross-namespace listing.
	}
	_, seq := s.storage.ListModifiedSince(ctx, key, sinceRv, nil)

	var (
		failed         []*pendingEvent
		successes      []*pendingEvent
		maxRv          = sinceRv
		lowestFailedRv = int64(math.MaxInt64)
	)

	flush := func(batch []*pendingEvent) bool {
		batchMax, batchLowestFailed, batchFailed, batchSuccess, abort := s.processEvents(ctx, sinceRv, batch)
		if abort {
			return false
		}
		if batchMax > maxRv {
			maxRv = batchMax
		}
		if batchLowestFailed < lowestFailedRv {
			lowestFailedRv = batchLowestFailed
		}
		failed = append(failed, batchFailed...)
		successes = append(successes, batchSuccess...)
		return true
	}

	batch := make([]*pendingEvent, 0, startupBatchSize)
	for mr, err := range seq {
		if ctx.Err() != nil {
			return
		}
		if err != nil {
			logger.Warn("reconciler: startupReconcile iterator error",
				"group", builder.Group(), "resource", builder.Resource(), "err", err)
			return
		}
		if mr == nil {
			continue
		}
		ev := &pendingEvent{
			action:    mr.Action,
			group:     mr.Key.Group,
			resource:  mr.Key.Resource,
			namespace: mr.Key.Namespace,
			name:      mr.Key.Name,
			value:     mr.Value,
			rv:        mr.ResourceVersion,
		}
		// Skip iter events that watch has already superseded with a
		// newer write — re-embedding the older copy would just be
		// overwritten by the watch event the next cycle.
		if s.supersedesPending(ev) {
			continue
		}
		batch = append(batch, ev)
		if len(batch) >= startupBatchSize {
			if !flush(batch) {
				return
			}
			batch = batch[:0]
		}
	}
	if len(batch) > 0 {
		if !flush(batch) {
			return
		}
	}

	target := pickLatestRV(sinceRv, maxRv, lowestFailedRv)
	if target > sinceRv {
		if err := s.vectorBackend.SetLatestRV(ctx, target); err != nil {
			logger.Error("reconciler: startupReconcile advance checkpoint",
				"err", err, "sinceRV", sinceRv, "target", target)
			// Cursor write failed: re-enqueue everything we touched so
			// the steady-state loop retries the advance with fresh
			// state. Without this the cursor stays stale until a new
			// write happens to arrive (forcing another full catch-up
			// on the next restart). Re-enqueue of already-embedded
			// events is idempotent — UpsertReplaceSubresources just
			// rewrites the same rows.
			for _, ev := range successes {
				s.enqueue(ev)
			}
			for _, ev := range failed {
				s.enqueue(ev)
			}
			return
		}
	}
	for _, ev := range failed {
		s.enqueue(ev)
	}
	logger.Info("reconciler: startupReconcile builder complete",
		"group", builder.Group(), "resource", builder.Resource(),
		"events", len(successes), "failed", len(failed),
		"from", sinceRv, "to", target)
}

// supersedesPending returns true if the shared pending map has an event for the
// same resource at a higher-or-equal RV. Used by reconcileSince so it
// doesn't waste work on iter events that watch has overtaken.
func (s *Reconciler) supersedesPending(ev *pendingEvent) bool {
	s.pendingMu.Lock()
	defer s.pendingMu.Unlock()
	existing, ok := s.pending[pendingKey(ev.group, ev.resource, ev.namespace, ev.name)]
	return ok && existing.rv >= ev.rv
}

// processPending drains the in-memory pending map (watch-sourced events
// in steady state, plus failed retries) and runs the batch through
// processBatch.
func (s *Reconciler) processPending(ctx context.Context) {
	s.processBatch(ctx, s.drainPending())
}

// processBatch runs the embed/upsert pipeline over a batch of pending
// events and advances the cursor. Used by processPending (steady state).
// reconcileSince calls processEvents directly so the cursor advances
// once after every startup batch, not per batch.
func (s *Reconciler) processBatch(ctx context.Context, batch []*pendingEvent) {
	if len(batch) == 0 {
		return
	}
	logger := s.log.FromContext(ctx)

	sinceRv, err := s.vectorBackend.GetLatestRV(ctx)
	if err != nil {
		logger.Error("reconciler: read checkpoint", "err", err)
		s.requeue(batch)
		return
	}

	maxRv, lowestFailedRv, failed, successes, abort := s.processEvents(ctx, sinceRv, batch)
	if abort {
		s.requeue(batch)
		return
	}

	selectedRV := pickLatestRV(sinceRv, maxRv, lowestFailedRv)
	if selectedRV > sinceRv {
		if err := s.vectorBackend.SetLatestRV(ctx, selectedRV); err != nil {
			logger.Error("reconciler: advance checkpoint", "err", err, "sinceRV", sinceRv, "selectedRV", selectedRV)
			s.requeue(batch)
			return
		}
	}

	for _, ev := range failed {
		s.enqueue(ev)
	}

	switch {
	case len(successes) == 0 && len(failed) == 0:
	case len(failed) == 0:
		logger.Info("reconciler: cycle processed",
			"events", len(successes),
			"from", sinceRv, "to", selectedRV)
	default:
		logger.Info("reconciler: cycle processed (partial)",
			"events", len(successes),
			"failed", len(failed),
			"from", sinceRv, "to", selectedRV)
	}
}

// processEvents runs the embed/upsert loop without advancing the
// cursor — the caller decides when to commit progress. sinceRv is the
// floor for the "already processed" filter; it stays pinned across
// calls so callers (like reconcileSince) that flush multiple batches
// don't accidentally filter out lower-RV events after an earlier batch
// would have bumped the checkpoint. abort is true if ctx was cancelled
// mid-loop; the caller should treat all events as un-processed.
func (s *Reconciler) processEvents(ctx context.Context, sinceRv int64, batch []*pendingEvent) (maxRv, lowestFailedRv int64, failed, successes []*pendingEvent, abort bool) {
	logger := s.log.FromContext(ctx)
	maxRv = sinceRv
	lowestFailedRv = math.MaxInt64
	for _, ev := range batch {
		if ctx.Err() != nil {
			return maxRv, lowestFailedRv, nil, nil, true
		}
		// Replayed history past the cursor was already processed; skip
		// it without spending an attempt.
		if ev.rv <= sinceRv {
			continue
		}
		builder, ok := s.builders[builderKey(ev.group, ev.resource)]
		if !ok {
			continue
		}

		// Increment before processing so recordFailure sees the
		// post-increment value when deciding whether to retry.
		ev.attempts++

		if err := s.processEvent(ctx, builder, ev); err != nil {
			logger.Warn("reconciler: process event",
				"namespace", ev.namespace, "name", ev.name,
				"rv", ev.rv, "attempts", ev.attempts,
				"action", ev.action, "err", err)
			lowestFailedRv = s.recordFailure(ev, &failed, lowestFailedRv, logger)
			continue
		}
		successes = append(successes, ev)
		if ev.rv > maxRv {
			maxRv = ev.rv
		}
	}
	return maxRv, lowestFailedRv, failed, successes, false
}

func (s *Reconciler) processEvent(ctx context.Context, builder embed.Builder, ev *pendingEvent) error {
	switch ev.action {
	case resourcepb.WatchEvent_DELETED:
		return s.vectorBackend.Delete(ctx, ev.namespace, s.batchEmbedder.Model(), builder.Resource(), ev.name)
	case resourcepb.WatchEvent_ADDED, resourcepb.WatchEvent_MODIFIED:
		return s.embedAndUpsert(ctx, builder, ev)
	default:
		return fmt.Errorf("unknown action %v", ev.action)
	}
}

// embedAndUpsert routes through UpsertReplaceSubresources so removing
// stale subresources and writing the new ones commit atomically — a
// failure mid-way leaves the dashboard in its previous self-consistent
// state.
//
// TODO: only re-embed subresources whose content actually changed
// since the last write. Today every dashboard write re-embeds every
// panel, which is wasteful when only one panel changed.
func (s *Reconciler) embedAndUpsert(ctx context.Context, builder embed.Builder, ev *pendingEvent) error {
	if len(ev.value) == 0 {
		return nil
	}
	key := &resourcepb.ResourceKey{
		Group:     builder.Group(),
		Resource:  builder.Resource(),
		Namespace: ev.namespace,
		Name:      ev.name,
	}
	items, err := builder.Extract(ctx, key, ev.value, "")
	if err != nil {
		return fmt.Errorf("extract: %w", err)
	}
	if maxItems := builder.MaxItemsPerResource(); maxItems > 0 && len(items) > maxItems {
		items = items[:maxItems]
	}

	// An empty extract means the dashboard has no embeddable content;
	// drop everything stored under this UID rather than leaving orphans.
	if len(items) == 0 {
		return s.vectorBackend.Delete(ctx, ev.namespace, s.batchEmbedder.Model(), builder.Resource(), ev.name)
	}

	vectors, err := s.batchEmbedder.Embed(ctx, ev.namespace, builder.Resource(), ev.rv, items)
	if err != nil {
		return fmt.Errorf("embed: %w", err)
	}
	if len(vectors) == 0 {
		return s.vectorBackend.Delete(ctx, ev.namespace, s.batchEmbedder.Model(), builder.Resource(), ev.name)
	}
	if err := s.vectorBackend.UpsertReplaceSubresources(ctx, vectors); err != nil {
		return fmt.Errorf("upsert: %w", err)
	}
	return nil
}

// requeue is the catch-all path when we can't tell what's persisted
// (e.g. cursor write failed). Successful events get filtered out by
// the cursor check on the next cycle; the wasted re-processing is
// idempotent.
func (s *Reconciler) requeue(events []*pendingEvent) {
	for _, ev := range events {
		s.enqueue(ev)
	}
}

// recordFailure assumes ev.attempts has already been incremented.
// Returning lowestFailedRv unchanged on cap-exhaustion is what lets
// the cursor move past a permanently broken event.
func (s *Reconciler) recordFailure(ev *pendingEvent, failed *[]*pendingEvent, lowestFailedRv int64, logger log.Logger) int64 {
	if ev.attempts >= maxEventAttempts {
		logger.Error("reconciler: dropping event past retry cap; cursor will advance past it",
			"namespace", ev.namespace, "name", ev.name,
			"rv", ev.rv, "attempts", ev.attempts, "action", ev.action)
		return lowestFailedRv
	}
	*failed = append(*failed, ev)
	if ev.rv < lowestFailedRv {
		return ev.rv
	}
	return lowestFailedRv
}

// pickLatestRV keeps the cursor strictly below any unhandled failure so
// the failed item is retried before the cursor moves past.
func pickLatestRV(sinceRv, latestRv, lowestFailedRv int64) int64 {
	if lowestFailedRv == math.MaxInt64 {
		return latestRv
	}
	candidate := lowestFailedRv - 1
	if candidate < sinceRv {
		return sinceRv
	}
	return candidate
}

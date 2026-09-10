// Package reconciler keeps the vector index in sync with ongoing
// dashboard writes. Each cycle drains an in-memory dedup map of watch
// events keyed by (group, resource, namespace, name) — enqueue keeps only
// the highest RV per resource, so a replayed older event can't overwrite
// a newer one before it's processed — and then sweeps everything written
// since the checkpoint.
//
// Only the sweep advances the checkpoint. Watch delivery is at-most-once
// on some notifiers, so the events that arrived can't show that nothing
// between them was missed; a completed listing from the cursor can.
package reconciler

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/foldertitle"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/search/embed/reconciler")

// Backfiller drains historical resources into the vector index. The
// reconciler ensures a job exists per builder, then runs it once.
type Backfiller interface {
	Run(ctx context.Context) error
}

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
// a sweep. When the listing iterator fills a batch to this
// cap, we flush it through processEvents, then resume listing. Keeps
// memory bounded over large catch-up windows. Package-level so tests
// can override.
var startupBatchSize = 1000

// maxStartupBatchBytes caps a startup batch's accumulated value bytes at
// 64 MiB before flushing. Package-level so tests can override.
var maxStartupBatchBytes = 64 * 1024 * 1024

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
	Backfiller        Backfiller
	Interval          time.Duration
	LockRetryInterval time.Duration
	// EmbeddingCountInterval paces the stored-embedding gauge. Each sample
	// is a full aggregate scan of the embeddings table, so it belongs far
	// above Interval. Zero disables the sampling entirely.
	EmbeddingCountInterval time.Duration
	// Metrics is optional; when nil the reconciler runs without
	// observability instrumentation (handy for unit tests).
	Metrics *resource.VectorMetrics
}

// Reconciler keeps the vector index in sync with ongoing writes. The
// advisory lock is held for the pod's lifetime (acquired in Run), so
// only one replica processes the pending map at a time and listing
// pagination doesn't ping-pong across replicas. Connection-bound pg
// session locks release naturally if the pod crashes.
type Reconciler struct {
	storage                resource.StorageBackend
	vectorBackend          vector.VectorBackend
	batchEmbedder          *embedder.BatchEmbedder
	builders               map[string]embed.Builder
	backfiller             Backfiller
	interval               time.Duration
	lockRetryInterval      time.Duration
	embeddingCountInterval time.Duration
	log                    log.Logger
	metrics                *resource.VectorMetrics

	// folderTitleResolver is uncached: event rate is low and fresh titles beat cache staleness.
	folderTitleResolver *foldertitle.Resolver

	// broadcaster is attached after construction by the resource server,
	broadcaster resource.Broadcaster[*resource.WrittenEvent]

	pendingMu sync.Mutex
	pending   map[string]*pendingEvent

	// Only ever touched from the sweep, which runs on Run's goroutine.
	lastSweepSinceRv int64
	lastSweepAt      time.Time

	// exhausted records the highest RV per resource whose retry budget
	// ran out, so a sweep re-listing it from storage doesn't hand it a
	// fresh one and pin the cursor below it forever. Bounded by the
	// number of permanently broken resources; an entry is dropped once
	// the resource is written again or sweeps stop listing it.
	exhaustedMu sync.Mutex
	exhausted   map[string]exhaustedEvent

	// ensuredResources tracks provisioned resources (have partition leaf and backfill job)
	ensuredResources map[string]struct{}
}

// New constructs the embedding reconciler.
// The caller is expected to attach a broadcaster via Reconciler.UseBroadcaster
// before calling Run. Without one the reconciler can only sweep, and a fleet
// that has never checkpointed stays inert: the cursor is seeded from the first
// delivered write, and the sweep does nothing until it is.
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
		storage:                opts.Storage,
		vectorBackend:          opts.VectorBackend,
		batchEmbedder:          opts.BatchEmbedder,
		builders:               builders,
		backfiller:             opts.Backfiller,
		interval:               opts.Interval,
		lockRetryInterval:      opts.LockRetryInterval,
		embeddingCountInterval: opts.EmbeddingCountInterval,
		log:                    log.New("embeddings_reconciler"),
		metrics:                opts.Metrics,
		pending:                make(map[string]*pendingEvent),
		exhausted:              make(map[string]exhaustedEvent),
		ensuredResources:       make(map[string]struct{}),
		folderTitleResolver:    foldertitle.NewResolver(opts.Storage),
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
	if s.metrics != nil {
		s.metrics.ReconcilerPendingEvents.Set(float64(len(s.pending)))
	}
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
	if s.metrics != nil {
		s.metrics.ReconcilerPendingEvents.Set(0)
	}
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

	// Backfill jobs are created lazily on the write path (the first event for
	// a resource); the backfiller drains them in the background on its own
	// advisory lock.
	if s.backfiller != nil {
		backfillDone := make(chan struct{})
		defer func() { <-backfillDone }()
		go func() {
			defer close(backfillDone)
			if err := s.backfiller.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
				s.log.Error("reconciler: backfiller stopped", "err", err)
			}
		}()
	}

	// Gauge sampling runs only on the lock holder so the aggregate scan
	// happens once per cluster rather than once per replica.
	if s.metrics != nil && s.embeddingCountInterval > 0 {
		go s.runEmbeddingCounts(ctx)
	}

	// Not load-bearing for correctness: the sweep lists everything past
	// the cursor whether or not an event was delivered.
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

	t := time.NewTicker(s.interval)
	defer t.Stop()

	// First cycle runs immediately, so a freshly-started replica catches
	// up on whatever it missed while it was down without waiting an
	// interval.
	s.reconcileCycle(ctx)
	for {
		select {
		case <-ctx.Done():
			s.log.Info("reconciler: stopping", "reason", ctx.Err())
			return ctx.Err()
		case <-t.C:
			s.reconcileCycle(ctx)
		}
	}
}

// reconcileCycle drains the pending map, then sweeps. Both run on the
// same ticker, so draining first is not a latency win today: it is the
// only path that retries a failed event, and the only thing that seeds
// the cursor on a fleet that has never checkpointed.
func (s *Reconciler) reconcileCycle(ctx context.Context) {
	s.processPending(ctx)
	s.sweep(ctx)
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

func (s *Reconciler) runEmbeddingCounts(ctx context.Context) {
	t := time.NewTicker(s.embeddingCountInterval)
	defer t.Stop()
	for {
		s.recordEmbeddingCounts(ctx)
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

// recordEmbeddingCounts refreshes the stored-embedding gauge. Reset drops
// label pairs that no longer exist — e.g. the superseded model after a
// rollout — instead of pinning them at their last observed value.
func (s *Reconciler) recordEmbeddingCounts(ctx context.Context) {
	counts, err := s.vectorBackend.CountStoredEmbeddings(ctx)
	if err != nil {
		if ctx.Err() == nil {
			s.log.Warn("reconciler: count stored embeddings", "err", err)
		}
		return
	}
	s.metrics.EmbeddingsStored.Reset()
	for _, c := range counts {
		s.metrics.EmbeddingsStored.WithLabelValues(c.Resource, c.Model).Set(float64(c.Count))
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
				rv:        resource.ToSnowflakeRV(ev.ResourceVersion),
			})
			s.log.Debug("reconciler: watch event enqueued",
				"namespace", ev.Key.Namespace,
				"name", ev.Key.Name,
				"action", ev.Type,
				"rv", ev.ResourceVersion)
		}
	}
}

// ensureResourceInitialized provisions a resource's partition leaf + backfill
// job on its first write event, once per process (idempotent via
// ensuredResources and the DB row). stoppingRV is the event's RV, bounding the
// backfill of pre-existing rows for that resource.
func (s *Reconciler) ensureResourceInitialized(ctx context.Context, b embed.Builder, stoppingRV int64) error {
	r := b.Resource()
	if _, ok := s.ensuredResources[r]; ok {
		return nil
	}

	if err := s.vectorBackend.EnsureResourcePartition(ctx, r); err != nil {
		return fmt.Errorf("ensure partition for %q: %w", r, err)
	}

	if err := s.vectorBackend.CreateBackfillJob(ctx, s.batchEmbedder.Model(), r, stoppingRV, b.Version()); err != nil {
		return fmt.Errorf("create backfill job for %q: %w", r, err)
	}
	s.ensuredResources[r] = struct{}{}
	return nil
}

// checkpointRV canonicalizes the persisted checkpoint to snowflake so it
// compares against event RVs across a SQL<->KV backend swap (a micro
// checkpoint from the sql backend would otherwise mis-compare).
func (s *Reconciler) checkpointRV(ctx context.Context) (int64, error) {
	rv, err := s.vectorBackend.GetLatestRV(ctx)
	if err != nil {
		return 0, err
	}
	return resource.ToSnowflakeRV(rv), nil
}

// sweep embeds everything written since the checkpoint. It is the only
// writer of the checkpoint: a completed walk from the cursor is the only
// thing that shows nothing below the new value was missed.
func (s *Reconciler) sweep(ctx context.Context) {
	sinceRv, err := s.checkpointRV(ctx)
	if err != nil {
		s.log.Error("reconciler: sweep read checkpoint", "err", err)
		return
	}
	if sinceRv == 0 {
		// Seeded by the first live batch; ListModifiedSince rejects 0.
		if s.broadcaster == nil {
			s.log.Warn("reconciler: cursor at 0 and no write event broadcaster; nothing will be embedded")
			return
		}
		s.log.Debug("reconciler: sweep skipped; cursor at 0, nothing to process")
		return
	}

	// A repeat sweep at an unchanged cursor lets the backend skip its
	// lookback window: writes in flight at sinceRv have committed by now.
	var calledAt *time.Time
	if s.lastSweepSinceRv == sinceRv && !s.lastSweepAt.IsZero() {
		calledAt = new(s.lastSweepAt)
	}
	startedAt := time.Now()

	// One cursor for every builder, so it can only move to the lowest RV
	// all of them proved.
	target := int64(math.MaxInt64)
	for _, b := range s.builders {
		if ctx.Err() != nil {
			return
		}
		proven, complete := s.reconcileSince(ctx, b, sinceRv, calledAt)
		if !complete {
			return
		}
		if proven < target {
			target = proven
		}
	}
	s.lastSweepSinceRv = sinceRv
	s.lastSweepAt = startedAt
	if target > sinceRv {
		if err := s.vectorBackend.SetLatestRV(ctx, target); err != nil {
			s.log.Error("reconciler: sweep advance checkpoint",
				"err", err, "sinceRV", sinceRv, "target", target)
			return
		}
		s.forgetExhaustedBelow(target)
	}
	s.log.Debug("reconciler: sweep complete", "from", sinceRv, "to", target)
}

// reconcileSince walks ListModifiedSince in batches and returns the RV
// it proved complete; complete is false if the walk was interrupted.
//
// sinceRv stays pinned; the caller advances the cursor only after the
// walk finishes. Listing is RV-descending on the event store and
// key-ordered on the data store, so rows yielded later can carry lower
// RVs than rows already seen: advancing to the highest RV seen so far
// would claim rows the walk has not reached, and an interrupted walk
// would leave them un-embedded with the cursor already past them.
func (s *Reconciler) reconcileSince(ctx context.Context, builder embed.Builder, sinceRv int64, lastCalledAt *time.Time) (int64, bool) {
	logger := s.log.FromContext(ctx)
	key := resource.NamespacedResource{
		Group:    builder.Group(),
		Resource: builder.Resource(),
		// Empty namespace → cross-namespace listing.
	}
	// The listing snapshot: the store's latest RV, read before the walk
	// and covered by it. It is a ceiling, not a floor: the walk may yield
	// a write that landed after the snapshot while a lower-RV write is
	// still in flight, so proving anything above it would jump the
	// in-flight one. Without a snapshot at all, an idle resource freezes
	// the cursor until it ages off the event store and listing falls back
	// to a full scan.
	latestRv, seq := s.storage.ListModifiedSince(ctx, key, sinceRv, lastCalledAt)
	ceiling := resource.ToSnowflakeRV(latestRv)

	var (
		failed         []*pendingEvent
		succeeded      int
		lowestFailedRv = int64(math.MaxInt64)
	)

	flush := func(batch []*pendingEvent) bool {
		batchLowestFailed, batchFailed, batchSuccess, abort := s.processEvents(ctx, batch)
		if abort {
			return false
		}
		if batchLowestFailed < lowestFailedRv {
			lowestFailedRv = batchLowestFailed
		}
		failed = append(failed, batchFailed...)
		succeeded += len(batchSuccess)
		return true
	}

	batch := make([]*pendingEvent, 0, startupBatchSize)
	var batchBytes int
	for mr, err := range seq {
		if ctx.Err() != nil {
			return sinceRv, false
		}
		if err != nil {
			logger.Warn("reconciler: reconcileSince iterator error",
				"group", builder.Group(), "resource", builder.Resource(), "err", err)
			return sinceRv, false
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
			rv:        resource.ToSnowflakeRV(mr.ResourceVersion),
		}
		// Skip iter events that watch has already superseded with a
		// newer write - re-embedding the older copy would just be
		// overwritten by the watch event the next cycle.
		if s.supersedesPending(ev, ceiling) || s.isExhausted(ev) {
			continue
		}
		batch = append(batch, ev)
		batchBytes += len(ev.value)
		if len(batch) >= startupBatchSize || batchBytes >= maxStartupBatchBytes {
			if !flush(batch) {
				return sinceRv, false
			}
			batch = batch[:0]
			batchBytes = 0
		}
	}
	if len(batch) > 0 {
		if !flush(batch) {
			return sinceRv, false
		}
	}

	target := pickLatestRV(sinceRv, resource.ToSnowflakeRV(latestRv), lowestFailedRv)
	for _, ev := range failed {
		s.enqueue(ev)
	}
	logger.Info("reconciler: reconcileSince builder complete",
		"group", builder.Group(), "resource", builder.Resource(),
		"events", succeeded, "failed", len(failed),
		"from", sinceRv, "to", target)
	return target, true
}

// supersedesPending reports whether the pending map holds a newer event
// for the same resource that the cursor cannot reach, letting the walk
// skip work watch has overtaken. Both conditions matter: at an equal RV,
// or at any RV the cursor is about to pass, the queued copy is dropped as
// already processed, so the walk has to embed it itself.
func (s *Reconciler) supersedesPending(ev *pendingEvent, ceiling int64) bool {
	s.pendingMu.Lock()
	defer s.pendingMu.Unlock()
	existing, ok := s.pending[pendingKey(ev.group, ev.resource, ev.namespace, ev.name)]
	return ok && existing.rv > ev.rv && existing.rv > ceiling
}

// dropPendingUpTo discards a queued event for the same resource at or
// below the RV just embedded. The walk bypasses the pending map, so a
// copy queued by an earlier failure would otherwise be retried over the
// newer revision the walk just stored, deleting the subresources that
// revision added.
func (s *Reconciler) dropPendingUpTo(ev *pendingEvent) {
	k := pendingKey(ev.group, ev.resource, ev.namespace, ev.name)
	s.pendingMu.Lock()
	defer s.pendingMu.Unlock()
	existing, ok := s.pending[k]
	if !ok || existing.rv > ev.rv {
		return
	}
	delete(s.pending, k)
	if s.metrics != nil {
		s.metrics.ReconcilerPendingEvents.Set(float64(len(s.pending)))
	}
}

// processPending drains the in-memory pending map (watch-sourced events,
// plus failed retries) and runs the batch through processBatch.
func (s *Reconciler) processPending(ctx context.Context) {
	s.processBatch(ctx, s.drainPending())
}

// processBatch runs the embed/upsert pipeline over a batch of pending
// events. It does not advance the cursor: the batch that arrived says
// nothing about the events that did not, so writing the cursor to the
// batch maximum would jump over an undelivered write for good.
func (s *Reconciler) processBatch(ctx context.Context, batch []*pendingEvent) {
	if len(batch) == 0 {
		return
	}
	logger := s.log.FromContext(ctx)

	sinceRv, err := s.checkpointRV(ctx)
	if err != nil {
		logger.Error("reconciler: read checkpoint", "err", err)
		s.requeue(batch)
		return
	}

	// A watch event at or below the cursor was covered by the walk that
	// moved the cursor there, and re-embedding it would overwrite the
	// newer content that walk already indexed. A failed event is exempt:
	// it is this reconciler's own retry, and the lookback window hands
	// back writes the cursor has already passed.
	live := make([]*pendingEvent, 0, len(batch))
	for _, ev := range batch {
		if ev.rv > sinceRv || ev.attempts > 0 {
			live = append(live, ev)
		}
	}
	batch = live

	_, failed, successes, abort := s.processEvents(ctx, batch)
	if abort {
		s.requeue(batch)
		return
	}

	// A cursor of 0 keeps the sweep switched off entirely, so hold the
	// batch until the seed lands instead of waiting for another write.
	if sinceRv == 0 && !s.seedCheckpoint(ctx, batch) {
		s.requeue(batch)
		return
	}

	for _, ev := range failed {
		s.enqueue(ev)
	}

	switch {
	case len(successes) == 0 && len(failed) == 0:
	case len(failed) == 0:
		logger.Info("reconciler: cycle processed", "events", len(successes))
	default:
		logger.Info("reconciler: cycle processed (partial)",
			"events", len(successes),
			"failed", len(failed))
	}
}

// seedCheckpoint gives the sweep somewhere to start on a fleet that has
// never checkpointed, since ListModifiedSince rejects 0. The seed sits
// below every RV in the batch, so the first sweep re-lists even these
// events; anything older belongs to the backfiller.
func (s *Reconciler) seedCheckpoint(ctx context.Context, batch []*pendingEvent) bool {
	seed := int64(math.MaxInt64)
	for _, ev := range batch {
		if ev.rv > 0 && ev.rv < seed {
			seed = ev.rv
		}
	}
	if seed == math.MaxInt64 {
		return true
	}
	if err := s.vectorBackend.SetLatestRV(ctx, seed-1); err != nil {
		s.log.FromContext(ctx).Error("reconciler: seed checkpoint", "err", err, "seed", seed-1)
		return false
	}
	s.log.FromContext(ctx).Info("reconciler: checkpoint seeded", "seed", seed-1)
	return true
}

// processEvents runs the embed/upsert loop without advancing the
// cursor — the caller decides when to commit progress. abort is true if
// ctx was cancelled mid-loop; the caller should treat all events as
// un-processed.
// For new resources, it ensures a partition and backfill job is created
func (s *Reconciler) processEvents(ctx context.Context, batch []*pendingEvent) (lowestFailedRv int64, failed, successes []*pendingEvent, abort bool) {
	logger := s.log.FromContext(ctx)
	lowestFailedRv = math.MaxInt64
	for _, ev := range batch {
		if ctx.Err() != nil {
			return lowestFailedRv, nil, nil, true
		}
		builder, ok := s.builders[builderKey(ev.group, ev.resource)]
		if !ok {
			continue
		}

		// Increment before processing so recordFailure sees the
		// post-increment value when deciding whether to retry.
		ev.attempts++

		// Ensure partition + backfill job before processing the event.
		if err := s.ensureResourceInitialized(ctx, builder, ev.rv); err != nil {
			logger.Error("reconciler: ensure resource for event",
				"group", ev.group, "resource", ev.resource, "err", err)
			lowestFailedRv = s.recordFailure(ev, &failed, lowestFailedRv, logger)
			continue
		}

		if err := s.processEvent(ctx, builder, ev); err != nil {
			logger.Warn("reconciler: process event",
				"namespace", ev.namespace, "name", ev.name,
				"rv", ev.rv, "attempts", ev.attempts,
				"action", ev.action, "err", err)
			lowestFailedRv = s.recordFailure(ev, &failed, lowestFailedRv, logger)
			continue
		}
		// successes accumulates across the whole startup backlog; drop the
		// embedded value so retention doesn't grow unbounded. Nothing reads
		// it afterwards — re-enqueue on checkpoint failure is a no-op for an
		// already-embedded resource.
		ev.value = nil
		s.dropPendingUpTo(ev)
		successes = append(successes, ev)
	}
	return lowestFailedRv, failed, successes, false
}

// processEvent dispatches on the event action and runs the per-event
// pipeline. The status label tracked through the function powers the
// reconciler_process_duration histogram observed in the deferred closure.
//
// On a write, only panels whose content changed are re-embedded;
// unchanged panels stay and stale ones are deleted.
func (s *Reconciler) processEvent(ctx context.Context, builder embed.Builder, ev *pendingEvent) (retErr error) {
	ctx, span := tracer.Start(ctx, "unified.reconciler.processEvent")
	defer span.End()
	span.SetAttributes(
		attribute.String("group", ev.group),
		attribute.String("resource", ev.resource),
		attribute.String("action", ev.action.String()),
		attribute.Int64("rv", ev.rv),
		attribute.Int("attempt", ev.attempts),
	)

	start := time.Now()
	statusLabel := "success"
	defer func() {
		if retErr != nil {
			span.RecordError(retErr)
			span.SetStatus(codes.Error, retErr.Error())
		}
		if s.metrics != nil {
			metricutil.ObserveWithExemplar(ctx,
				s.metrics.ReconcilerProcessDuration.WithLabelValues(ev.group, ev.resource, statusLabel),
				time.Since(start).Seconds(),
			)
		}
	}()

	switch ev.action {
	case resourcepb.WatchEvent_DELETED:
		if _, _, err := s.vectorBackend.DeleteRows(ctx, ev.namespace, s.batchEmbedder.Model(), builder.Resource(), vector.DeleteSelector{UIDs: []string{ev.name}}); err != nil {
			statusLabel = "delete_error"
			return err
		}
		return nil
	case resourcepb.WatchEvent_ADDED, resourcepb.WatchEvent_MODIFIED:
		// code execution continues below to extract → embed → upsert
	default:
		statusLabel = "unknown_action"
		return fmt.Errorf("unknown action %v", ev.action)
	}

	if embed.HasPendingDeleteLabel(ev.value) {
		statusLabel = "skipped_pending_delete"
		return nil
	}

	if len(ev.value) == 0 {
		return nil
	}
	key := &resourcepb.ResourceKey{
		Group:     builder.Group(),
		Resource:  builder.Resource(),
		Namespace: ev.namespace,
		Name:      ev.name,
	}

	folderTitle, err := s.folderTitleResolver.Title(ctx, ev.namespace, embed.FolderUIDFromValue(ev.value))
	if err != nil {
		statusLabel = "folder_title_error"
		return fmt.Errorf("resolve folder title: %w", err)
	}

	items, err := builder.Extract(ctx, key, ev.value, folderTitle)
	if err != nil {
		statusLabel = "extract_error"
		return fmt.Errorf("extract: %w", err)
	}
	if maxItems := builder.MaxItemsPerResource(); maxItems > 0 && len(items) > maxItems {
		items = items[:maxItems]
	}

	model := s.batchEmbedder.Model()

	// An empty extract means the dashboard has no embeddable content;
	// drop everything stored under this UID rather than leaving orphans.
	if len(items) == 0 {
		s.log.Info("skipping empty extract", "namespace", ev.namespace, "group", ev.group, "resource", ev.resource, "name", ev.name)
		if _, _, err := s.vectorBackend.DeleteRows(ctx, ev.namespace, model, builder.Resource(), vector.DeleteSelector{UIDs: []string{ev.name}}); err != nil {
			statusLabel = "delete_error"
			return err
		}
		return nil
	}

	uid := items[0].UID

	stored, storedFolder, err := s.vectorBackend.GetSubresourceContent(ctx, ev.namespace, model, builder.Resource(), uid)
	if err != nil {
		statusLabel = "get_content_error"
		return fmt.Errorf("get stored content: %w", err)
	}

	// A folder move refreshes the stored folder (search authz) without
	// changing content, so force a re-embed when it differs.
	folderMoved := len(stored) > 0 && storedFolder != items[0].Folder

	desired := make([]string, 0, len(items))
	toEmbed := make([]embed.Item, 0, len(items))
	present := make(map[string]struct{}, len(items))
	for _, it := range items {
		desired = append(desired, it.Subresource)
		prev, ok := stored[it.Subresource]
		if ok {
			present[it.Subresource] = struct{}{}
		}
		if folderMoved || !ok || prev != it.Content {
			toEmbed = append(toEmbed, it)
		}
	}

	extracted, embedded, deleted := len(desired), len(toEmbed), len(stored)-len(present)
	span.SetAttributes(
		attribute.Int("subresources.extracted", extracted),
		attribute.Int("subresources.embedded", embedded),
		attribute.Int("subresources.deleted", deleted),
	)
	recordCounts := func() {
		if s.metrics == nil {
			return
		}
		s.metrics.ReconcilerSubresourcesExtractedTotal.WithLabelValues(ev.group, ev.resource).Add(float64(extracted))
		s.metrics.ReconcilerSubresourcesEmbeddedTotal.WithLabelValues(ev.group, ev.resource).Add(float64(embedded))
		s.metrics.ReconcilerSubresourcesDeletedTotal.WithLabelValues(ev.group, ev.resource).Add(float64(deleted))
	}

	if embedded == 0 && deleted == 0 {
		recordCounts()
		return nil
	}

	var changed []vector.Vector
	if len(toEmbed) > 0 {
		changed, err = s.batchEmbedder.Embed(ctx, ev.namespace, builder.Resource(), ev.rv, builder.Version(), toEmbed)
		if err != nil {
			statusLabel = "embed_error"
			return fmt.Errorf("embed: %w", err)
		}
	}

	// UpsertReplaceSubresources commits the stale-delete and the new
	// inserts atomically — a failure mid-way leaves the dashboard in
	// its previous self-consistent state.
	if err := s.vectorBackend.UpsertReplaceSubresources(ctx, ev.namespace, model, builder.Resource(), uid, changed, nil, desired); err != nil {
		statusLabel = "upsert_error"
		return fmt.Errorf("upsert: %w", err)
	}
	recordCounts()
	return nil
}

// requeue is the catch-all path when we can't tell what's persisted
// (e.g. cursor write failed). Successful events get filtered out by
// the cursor check on the next cycle; the wasted re-processing is
// idempotent.
func (s *Reconciler) requeue(events []*pendingEvent) {
	for _, ev := range events {
		s.enqueue(ev)
		if s.metrics != nil {
			s.metrics.ReconcilerRetriesTotal.WithLabelValues(ev.group, ev.resource).Inc()
		}
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
		if s.metrics != nil {
			s.metrics.ReconcilerEventsDroppedTotal.
				WithLabelValues(ev.group, ev.resource, "retries_exhausted").
				Inc()
		}
		s.markExhausted(ev)
		return lowestFailedRv
	}
	*failed = append(*failed, ev)
	if ev.rv < lowestFailedRv {
		return ev.rv
	}
	return lowestFailedRv
}

// exhaustedEvent is the RV a resource gave up at, plus whether listing
// has handed that RV back since the last cursor advance.
type exhaustedEvent struct {
	rv       int64
	relisted bool
}

// markExhausted remembers that this resource gave up at this RV.
func (s *Reconciler) markExhausted(ev *pendingEvent) {
	k := pendingKey(ev.group, ev.resource, ev.namespace, ev.name)
	s.exhaustedMu.Lock()
	defer s.exhaustedMu.Unlock()
	if s.exhausted[k].rv < ev.rv {
		s.exhausted[k] = exhaustedEvent{rv: ev.rv, relisted: true}
	}
}

// isExhausted reports whether this event already used up its retries. A
// newer RV for the same resource is a fresh write, so it drops the
// record and gets a full budget.
func (s *Reconciler) isExhausted(ev *pendingEvent) bool {
	k := pendingKey(ev.group, ev.resource, ev.namespace, ev.name)
	s.exhaustedMu.Lock()
	defer s.exhaustedMu.Unlock()
	at, ok := s.exhausted[k]
	if !ok {
		return false
	}
	if ev.rv > at.rv {
		delete(s.exhausted, k)
		return false
	}
	at.relisted = true
	s.exhausted[k] = at
	return true
}

// forgetExhaustedBelow drops records below the cursor that the last
// sweep did not list. Passing the cursor is not enough on its own: the
// backend lists from a lookback window behind the cursor, so a record
// still being handed back has to stay or the resource gets a fresh
// budget every advance.
func (s *Reconciler) forgetExhaustedBelow(rv int64) {
	s.exhaustedMu.Lock()
	defer s.exhaustedMu.Unlock()
	for k, at := range s.exhausted {
		switch {
		case at.rv > rv:
		case at.relisted:
			at.relisted = false
			s.exhausted[k] = at
		default:
			delete(s.exhausted, k)
		}
	}
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

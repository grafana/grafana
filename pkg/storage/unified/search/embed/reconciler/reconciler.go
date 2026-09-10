// Package reconciler keeps the vector index in sync by sweeping writes since
// a durable checkpoint. Watch notifications only seed the initial checkpoint;
// payloads are read and processed one at a time from storage.
package reconciler

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/grafana/dskit/backoff"
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
// can't wedge cursor advancement forever. This includes provider errors:
// providers can misclassify an invalid request as temporarily unavailable.
const maxEventAttempts = 5

// defaultLockRetryInterval is how long Run waits between attempts to
// acquire the reconciler advisory lock when another replica holds it.
// The loser is idle anyway, so longer intervals reduce churn against
// postgres without delaying real work.
const defaultLockRetryInterval = 10 * time.Second

// reconcileEvent is transient: no resource payload survives a sweep iteration.
type reconcileEvent struct {
	action    resourcepb.WatchEvent_Type
	group     string
	resource  string
	namespace string
	name      string
	value     []byte
	rv        int64
	attempts  int
}

func retryKey(group, resource, namespace, name string) string {
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
// only one replica sweeps at a time. Connection-bound pg
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

	seedMu sync.Mutex
	seedRV int64
	seeded bool

	// The remaining state is only touched by Run's goroutine.
	lastSweepSinceRv int64
	lastSweepAt      time.Time
	embedRetryAt     time.Time
	embedBackoff     *backoff.Backoff

	// Only failures retain bookkeeping; their payloads are re-read by the sweep.
	retries map[string]retryState

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
		retries:                make(map[string]retryState),
		ensuredResources:       make(map[string]struct{}),
		folderTitleResolver:    foldertitle.NewResolver(opts.Storage),
	}, nil
}

func (s *Reconciler) UseBroadcaster(b resource.Broadcaster[*resource.WrittenEvent]) {
	s.broadcaster = b
}

// observeWrite remembers only the earliest RV needed to bootstrap a new fleet.
func (s *Reconciler) observeWrite(ev *resource.WrittenEvent) {
	if ev == nil || ev.Key == nil || ev.Key.Namespace == "" {
		return
	}
	if _, ok := s.builders[builderKey(ev.Key.Group, ev.Key.Resource)]; !ok {
		return
	}
	rv := resource.ToSnowflakeRV(ev.ResourceVersion)
	if rv <= 0 {
		return
	}
	s.seedMu.Lock()
	defer s.seedMu.Unlock()
	if !s.seeded && (s.seedRV == 0 || rv < s.seedRV) {
		s.seedRV = rv
	}
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
	s.sweep(ctx)
	for {
		select {
		case <-ctx.Done():
			s.log.Info("reconciler: stopping", "reason", ctx.Err())
			return ctx.Err()
		case <-t.C:
			s.sweep(ctx)
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
			s.observeWrite(ev)
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
	if time.Now().Before(s.embedRetryAt) {
		return
	}
	sinceRv, err := s.checkpointRV(ctx)
	if err != nil {
		s.log.Error("reconciler: sweep read checkpoint", "err", err)
		return
	}
	if sinceRv == 0 {
		sinceRv, err = s.seedCheckpoint(ctx)
		if err != nil {
			s.log.Error("reconciler: seed checkpoint", "err", err)
			return
		}
		if sinceRv == 0 {
			if s.broadcaster == nil {
				s.log.Warn("reconciler: cursor at 0 and no write event broadcaster; nothing will be embedded")
			}
			return
		}
	}
	s.seedMu.Lock()
	s.seeded, s.seedRV = true, 0
	s.seedMu.Unlock()
	for k, state := range s.retries {
		state.seen = false
		s.retries[k] = state
	}
	defer s.recordRetryCount()

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
	hasFailures := false
	for _, b := range s.builders {
		if ctx.Err() != nil {
			return
		}
		proven, complete, failed := s.reconcileSince(ctx, b, sinceRv, calledAt)
		hasFailures = hasFailures || failed
		if !complete {
			return
		}
		if proven < target {
			target = proven
		}
	}
	// An unresolved lookback failure may sit below the checkpoint. Continue
	// listing that window until it succeeds or exhausts its retry allowance.
	if !hasFailures {
		s.lastSweepSinceRv = sinceRv
		s.lastSweepAt = startedAt
	} else {
		s.lastSweepAt = time.Time{}
	}
	if target > sinceRv {
		if err := s.vectorBackend.SetLatestRV(ctx, target); err != nil {
			s.log.Error("reconciler: sweep advance checkpoint",
				"err", err, "sinceRV", sinceRv, "target", target)
			return
		}
	}
	for k, state := range s.retries {
		if !state.seen && state.rv <= target {
			delete(s.retries, k)
		}
	}
	s.log.Debug("reconciler: sweep complete", "from", sinceRv, "to", target)
	s.embedBackoff = nil
}

// reconcileSince walks ListModifiedSince one resource at a time and returns the RV
// it proved complete; complete is false if the walk was interrupted.
//
// sinceRv stays pinned; the caller advances the cursor only after the
// walk finishes. Listing is RV-descending on the event store and
// key-ordered on the data store, so rows yielded later can carry lower
// RVs than rows already seen: advancing to the highest RV seen so far
// would claim rows the walk has not reached, and an interrupted walk
// would leave them un-embedded with the cursor already past them.
func (s *Reconciler) reconcileSince(ctx context.Context, builder embed.Builder, sinceRv int64, lastCalledAt *time.Time) (proven int64, complete, failed bool) {
	key := resource.NamespacedResource{Group: builder.Group(), Resource: builder.Resource()}
	// Writes arriving during listing must not lift this checkpoint ceiling.
	latestRv, seq := s.storage.ListModifiedSince(ctx, key, sinceRv, lastCalledAt)
	lowestFailedRv := int64(math.MaxInt64)
	listed, failures := 0, 0
	for mr, err := range seq {
		if ctx.Err() != nil {
			return sinceRv, false, false
		}
		if err != nil {
			s.log.FromContext(ctx).Warn("reconciler: reconcileSince iterator error",
				"group", builder.Group(), "resource", builder.Resource(), "err", err)
			return sinceRv, false, false
		}
		if mr == nil {
			continue
		}
		ev := &reconcileEvent{
			action: mr.Action, group: mr.Key.Group, resource: mr.Key.Resource,
			namespace: mr.Key.Namespace, name: mr.Key.Name, value: mr.Value,
			rv: resource.ToSnowflakeRV(mr.ResourceVersion),
		}
		listed++
		failed, abort := s.processListedEvent(ctx, builder, ev)
		if abort {
			return sinceRv, false, false
		}
		if failed {
			failures++
			lowestFailedRv = min(lowestFailedRv, ev.rv)
		}
	}
	target := pickLatestRV(sinceRv, resource.ToSnowflakeRV(latestRv), lowestFailedRv)
	s.log.FromContext(ctx).Info("reconciler: reconcileSince builder complete",
		"group", builder.Group(), "resource", builder.Resource(),
		"listed", listed, "failed", failures, "from", sinceRv, "to", target)
	return target, true, failures > 0
}

func (s *Reconciler) seedCheckpoint(ctx context.Context) (int64, error) {
	s.seedMu.Lock()
	seed := s.seedRV
	s.seedMu.Unlock()
	if seed == 0 {
		return 0, nil
	}
	// Persist before any provider call so the first write survives a restart.
	if err := s.vectorBackend.SetLatestRV(ctx, seed-1); err != nil {
		return 0, err
	}
	return seed - 1, nil
}

// processListedEvent retains only retry bookkeeping. A newer revision starts
// with a fresh allowance. Provider errors also consume the five attempts.
func (s *Reconciler) processListedEvent(ctx context.Context, builder embed.Builder, ev *reconcileEvent) (failed, abort bool) {
	if ctx.Err() != nil {
		return false, true
	}
	k := retryKey(ev.group, ev.resource, ev.namespace, ev.name)
	if state, ok := s.retries[k]; ok {
		if ev.rv <= state.rv {
			state.seen = true
			s.retries[k] = state
			if state.attempts >= maxEventAttempts {
				return false, false
			}
			ev.attempts = state.attempts
		} else {
			delete(s.retries, k)
		}
	}
	ev.attempts++
	err := s.ensureResourceInitialized(ctx, builder, ev.rv)
	if err == nil {
		err = s.processEvent(ctx, builder, ev)
	}
	if ctx.Err() != nil {
		return false, true
	}
	if err == nil {
		delete(s.retries, k)
		return false, false
	}
	var retryErr *embedder.RetryableError
	abort = errors.As(err, &retryErr)
	if abort {
		s.backoffEmbedding(ctx, ev, retryErr)
	}
	s.retries[k] = retryState{rv: ev.rv, attempts: ev.attempts, seen: true}
	logger := s.log.FromContext(ctx)
	if ev.attempts >= maxEventAttempts {
		logger.Error("reconciler: dropping event past retry cap; cursor will advance past it",
			"namespace", ev.namespace, "name", ev.name, "rv", ev.rv, "err", err)
		if s.metrics != nil {
			s.metrics.ReconcilerEventsDroppedTotal.WithLabelValues(ev.group, ev.resource, "retries_exhausted").Inc()
		}
		return false, abort
	}
	logger.Warn("reconciler: process event", "namespace", ev.namespace, "name", ev.name,
		"rv", ev.rv, "attempts", ev.attempts, "err", err)
	if s.metrics != nil {
		s.metrics.ReconcilerRetriesTotal.WithLabelValues(ev.group, ev.resource).Inc()
	}
	return true, abort
}

// processEvent dispatches on the event action and runs the per-event
// pipeline. The status label tracked through the function powers the
// reconciler_process_duration histogram observed in the deferred closure.
//
// On a write, only panels whose content changed are re-embedded;
// unchanged panels stay and stale ones are deleted.
func (s *Reconciler) processEvent(ctx context.Context, builder embed.Builder, ev *reconcileEvent) (retErr error) {
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

type retryState struct {
	rv       int64
	attempts int
	seen     bool
}

func (s *Reconciler) recordRetryCount() {
	if s.metrics == nil {
		return
	}
	pending := 0
	for _, state := range s.retries {
		if state.attempts < maxEventAttempts {
			pending++
		}
	}
	s.metrics.ReconcilerPendingEvents.Set(float64(pending))
}

// pickLatestRV keeps the cursor strictly below any unhandled failure so
// the failed item is retried before the cursor moves past.
func pickLatestRV(sinceRv, latestRv, lowestFailedRv int64) int64 {
	if lowestFailedRv == math.MaxInt64 {
		return latestRv
	}
	candidate := min(latestRv, lowestFailedRv-1)
	if candidate < sinceRv {
		return sinceRv
	}
	return candidate
}

const (
	minEmbedRetryDelay = time.Minute
	maxEmbedRetryDelay = 5 * time.Minute
)

func (s *Reconciler) backoffEmbedding(ctx context.Context, ev *reconcileEvent, err *embedder.RetryableError) {
	if ctx.Err() != nil {
		return
	}
	if s.embedBackoff == nil {
		s.embedBackoff = backoff.New(ctx, backoff.Config{
			MinBackoff: minEmbedRetryDelay,
			MaxBackoff: maxEmbedRetryDelay,
			MaxRetries: 0,
		})
	}
	now := time.Now()
	providerDelay := err.RetryAfter
	delay := min(maxEmbedRetryDelay, max(s.embedBackoff.NextDelay(), providerDelay))
	s.embedRetryAt = now.Add(delay)
	s.log.FromContext(ctx).Warn("reconciler: embedding provider backoff; checkpoint retained",
		"namespace", ev.namespace, "name", ev.name, "rv", ev.rv,
		"retryAt", s.embedRetryAt, "delay", delay, "providerDelay", providerDelay, "err", err)
}

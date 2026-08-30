package usagestats

import (
	"context"
	"errors"
	"iter"
	"strings"
	"sync"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	defaultFlushInterval = 10 * time.Second

	// defaultMaxBufferedObjects bounds the in-memory buffer. Events for new
	// objects beyond this limit are dropped (recorded via the dropped-events
	// metric) so a misbehaving client can't exhaust memory.
	defaultMaxBufferedObjects = 50000

	flushLeasePrefix = "stats-flush/"

	flushLeaseTTL = 30 * time.Second
)

var ErrInvalidEvent = errors.New("invalid usage event")

type groupResourceNamespaceRef struct {
	Group     string
	Resource  string
	Namespace string
}

func (s groupResourceNamespaceRef) leaseName() string {
	return flushLeasePrefix + strings.Join([]string{s.Group, s.Resource, s.Namespace}, "/")
}

type Ingester struct {
	services.Service

	store   *Store
	decls   *Declarations
	leases  *lease.Manager
	metrics *metrics
	log     log.Logger
	now     func() time.Time

	flushInterval      time.Duration
	maxBufferedObjects int

	mu     sync.Mutex
	buffer map[objectRef]map[string]uint64
}

type IngesterOptions struct {
	Store        *Store
	Declarations *Declarations
	Leases       *lease.Manager
	Reg          prometheus.Registerer
	Log          log.Logger

	FlushInterval      time.Duration
	MaxBufferedObjects int
	// Now overrides the clock for testing; defaults to time.Now.
	Now func() time.Time
}

func NewIngester(opts IngesterOptions) (*Ingester, error) {
	// The flush loop serializes its read-add-write per namespace with a lease;
	// without one, concurrent flushes across pods would lose increments.
	if opts.Leases == nil {
		return nil, errors.New("usage stats ingester requires a lease manager")
	}
	decls := opts.Declarations
	if decls == nil {
		decls = DefaultDeclarations()
	}
	if err := decls.Validate(); err != nil {
		return nil, err
	}
	now := opts.Now
	if now == nil {
		now = time.Now
	}
	flushInterval := opts.FlushInterval
	if flushInterval <= 0 {
		flushInterval = defaultFlushInterval
	}
	maxBuffered := opts.MaxBufferedObjects
	if maxBuffered <= 0 {
		maxBuffered = defaultMaxBufferedObjects
	}
	logger := opts.Log
	if logger == nil {
		logger = log.New("unified-storage.usagestats")
	}
	i := &Ingester{
		store:              opts.Store,
		decls:              decls,
		leases:             opts.Leases,
		metrics:            newMetrics(opts.Reg),
		log:                logger,
		now:                now,
		flushInterval:      flushInterval,
		maxBufferedObjects: maxBuffered,
		buffer:             map[objectRef]map[string]uint64{},
	}
	i.Service = services.NewBasicService(nil, i.running, i.stopping)
	return i, nil
}

func objectRefFromKey(key *resourcepb.ResourceKey) objectRef {
	return objectRef{
		Group:     key.Group,
		Resource:  key.Resource,
		Namespace: key.Namespace,
		Name:      key.Name,
	}
}

func (i *Ingester) RecordEvent(_ context.Context, key *resourcepb.ResourceKey, events []*resourcepb.ResourceEvent) error {
	decl, ok := i.decls.Lookup(key.Group, key.Resource)
	if !ok {
		i.metrics.dropEvents(reasonUntrackedResource, len(events))
		return nil
	}
	if len(events) == 0 {
		return nil
	}

	// Validate everything before mutating the buffer so a partially-invalid
	// request doesn't record some events and reject others.
	deltas := make(map[string]uint64, len(events))
	for _, e := range events {
		if !decl.HasMetric(e.Metric) {
			i.metrics.dropEvents(reasonUnknownMetric, len(events))
			return ErrInvalidEvent
		}
		deltas[e.Metric] += e.Value
	}

	o := objectRefFromKey(key)

	i.mu.Lock()
	defer i.mu.Unlock()
	cur, exists := i.buffer[o]
	if !exists {
		if len(i.buffer) >= i.maxBufferedObjects {
			i.metrics.dropEvents(reasonBufferFull, len(events))
			return nil
		}
		cur = map[string]uint64{}
		i.buffer[o] = cur
	}
	for metric, v := range deltas {
		cur[metric] += v
	}
	return nil
}

func (i *Ingester) running(ctx context.Context) error {
	ticker := time.NewTicker(i.flushInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			if err := i.flush(ctx); err != nil {
				i.log.Warn("usage stats flush failed", "error", err)
			}
		}
	}
}

func (i *Ingester) stopping(_ error) error {
	flushCtx, cancel := context.WithTimeout(context.Background(), i.flushInterval)
	defer cancel()
	if err := i.flush(flushCtx); err != nil {
		i.log.Warn("final usage stats flush failed", "error", err)
	}
	return nil
}

func (i *Ingester) drain() map[objectRef]map[string]uint64 {
	i.mu.Lock()
	defer i.mu.Unlock()
	if len(i.buffer) == 0 {
		return nil
	}
	out := i.buffer
	i.buffer = map[objectRef]map[string]uint64{}
	return out
}

func (i *Ingester) mergeBack(o objectRef, deltas map[string]uint64) {
	i.mu.Lock()
	defer i.mu.Unlock()
	cur, ok := i.buffer[o]
	if !ok {
		if len(i.buffer) >= i.maxBufferedObjects {
			var dropped uint64
			for _, v := range deltas {
				dropped += v
			}
			i.metrics.dropEvents(reasonBufferFull, int(dropped))
			return
		}
		cur = map[string]uint64{}
		i.buffer[o] = cur
	}
	for metric, v := range deltas {
		cur[metric] += v
	}
}

func groupByNamespace(objs map[objectRef]map[string]uint64) map[groupResourceNamespaceRef][]objectRef {
	byNamespace := map[groupResourceNamespaceRef][]objectRef{}
	for o := range objs {
		scope := groupResourceNamespaceRef{Group: o.Group, Resource: o.Resource, Namespace: o.Namespace}
		byNamespace[scope] = append(byNamespace[scope], o)
	}
	return byNamespace
}

func (i *Ingester) flush(ctx context.Context) error {
	drained := i.drain()
	if len(drained) == 0 {
		return nil
	}
	start := i.now()
	defer func() { i.metrics.flushDuration.Observe(i.now().Sub(start).Seconds()) }()

	day := i.now().Format(dayLayout)
	var firstErr error

	for scope, objs := range groupByNamespace(drained) {
		if err := i.flushNamespace(ctx, scope, day, objs, drained); err != nil {
			i.log.Error("failed to flush usage stats for namespace",
				"group", scope.Group, "resource", scope.Resource, "namespace", scope.Namespace,
				"objects", len(objs), "error", err)
			if firstErr == nil {
				firstErr = err
			}
		}
	}
	return firstErr
}

func (i *Ingester) flushNamespace(ctx context.Context, scope groupResourceNamespaceRef, day string, objs []objectRef, drained map[objectRef]map[string]uint64) error {
	decl, ok := i.decls.Lookup(scope.Group, scope.Resource)
	if !ok {
		// Declaration disappeared; nothing valid to write.
		return nil
	}

	rebufferFrom := func(idx int) {
		for _, o := range objs[idx:] {
			if d := drained[o]; len(d) > 0 {
				i.mergeBack(o, d)
			}
		}
	}

	l, err := i.leases.Acquire(ctx, scope.leaseName(), lease.WithTTL(flushLeaseTTL), lease.WithAutoRenew())
	if err != nil {
		rebufferFrom(0)
		return err
	}
	defer func() {
		if releaseErr := i.leases.Release(context.WithoutCancel(ctx), l); releaseErr != nil {
			i.log.Warn("releasing usage stats flush lease failed", "lease", scope.leaseName(), "error", releaseErr)
		}
	}()

	for idx, o := range objs {
		select {
		case <-l.Lost():
			i.log.Warn("usage stats flush lease lost; rebuffering remaining objects",
				"group", scope.Group, "resource", scope.Resource, "namespace", scope.Namespace,
				"remaining", len(objs)-idx)
			rebufferFrom(idx)
			return nil
		default:
		}

		deltas := drained[o]
		if len(deltas) == 0 {
			continue
		}
		if derr := i.store.IncrementDaily(ctx, o, day, deltas); derr != nil {
			// Nothing applied: retry this object and everything after it.
			rebufferFrom(idx)
			return derr
		}
		if aerr := i.store.IncrementAggregates(ctx, o, aggregateDeltas(decl, deltas)); aerr != nil {
			// Best-effort: the daily bucket is already committed, so we do not
			// retry (that would double-count it). The reconciler rebuilds
			// aggregates from the daily buckets.
			i.metrics.aggregateWriteFailures.Inc()
			i.log.Warn("usage stats aggregate write failed; leaving it for the reconciler",
				"group", scope.Group, "resource", scope.Resource, "namespace", scope.Namespace,
				"name", o.Name, "error", aerr)
			continue
		}
	}
	return nil
}

func aggregateDeltas(decl StatsDeclaration, deltas map[string]uint64) map[string]uint64 {
	out := make(map[string]uint64, len(deltas)*(len(decl.Windows)+1))
	for metric, v := range deltas {
		if v == 0 {
			continue
		}
		for _, w := range decl.Windows {
			out[aggregateField(metric, w)] += v
		}
		out[totalField(metric)] += v
	}
	return out
}

// for tests
func (i *Ingester) Flush(ctx context.Context) error {
	return i.flush(ctx)
}

func (i *Ingester) GetResourceDailyStats(ctx context.Context, key *resourcepb.ResourceKey, fromDay, toDay string) iter.Seq2[*resourcepb.DailyStat, error] {
	return func(yield func(*resourcepb.DailyStat, error) bool) {
		if _, ok := i.decls.Lookup(key.Group, key.Resource); !ok {
			return
		}
		o := objectRefFromKey(key)
		// The store already yields buckets in ascending chronological order.
		for bucket, err := range i.store.ReadDailyRange(ctx, o, fromDay, toDay) {
			if err != nil {
				yield(nil, err)
				return
			}
			if !yield(&resourcepb.DailyStat{Day: bucket.Day, Metrics: bucket.Metrics}, nil) {
				return
			}
		}
	}
}

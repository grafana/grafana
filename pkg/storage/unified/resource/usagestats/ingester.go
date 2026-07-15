package usagestats

import (
	"context"
	"errors"
	"slices"
	"strings"
	"sync"
	"time"

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

	wg     sync.WaitGroup
	cancel context.CancelFunc
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
	return &Ingester{
		store:              opts.Store,
		decls:              decls,
		leases:             opts.Leases,
		metrics:            newMetrics(opts.Reg),
		log:                logger,
		now:                now,
		flushInterval:      flushInterval,
		maxBufferedObjects: maxBuffered,
		buffer:             map[objectRef]map[string]uint64{},
	}, nil
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

func (i *Ingester) Start(ctx context.Context) {
	ctx, cancel := context.WithCancel(ctx)
	i.cancel = cancel
	i.wg.Add(1)
	go func() {
		defer i.wg.Done()
		ticker := time.NewTicker(i.flushInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				flushCtx, c := context.WithTimeout(context.Background(), i.flushInterval)
				if err := i.flush(flushCtx); err != nil {
					i.log.Warn("final usage stats flush failed", "error", err)
				}
				c()
				return
			case <-ticker.C:
				if err := i.flush(ctx); err != nil {
					i.log.Warn("usage stats flush failed", "error", err)
				}
			}
		}
	}()
}

func (i *Ingester) Stop() {
	if i.cancel != nil {
		i.cancel()
	}
	i.wg.Wait()
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

	day := i.now().UTC().Format(dayLayout)
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

	l, err := i.leases.Acquire(ctx, scope.leaseName())
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

func (i *Ingester) GetResourceDailyStats(ctx context.Context, key *resourcepb.ResourceKey, fromDay, toDay string) ([]*resourcepb.DailyStat, error) {
	if _, ok := i.decls.Lookup(key.Group, key.Resource); !ok {
		return nil, nil
	}
	o := objectRefFromKey(key)
	byDay, err := i.store.ReadDailyRange(ctx, o, fromDay, toDay)
	if err != nil {
		return nil, err
	}

	// Day strings are zero-padded YYYY-MM-DD, so lexical order matches
	// chronological order.
	days := make([]string, 0, len(byDay))
	for day := range byDay {
		days = append(days, day)
	}
	slices.Sort(days)

	out := make([]*resourcepb.DailyStat, 0, len(days))
	for _, day := range days {
		out = append(out, &resourcepb.DailyStat{Day: day, Metrics: byDay[day]})
	}
	return out, nil
}

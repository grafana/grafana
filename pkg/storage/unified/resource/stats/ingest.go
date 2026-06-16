package stats

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
)

// ErrInvalidMetric is returned by RecordEvent for a metric name not declared
// for the resource. Maps to gRPC InvalidArgument at the RPC boundary.
var ErrInvalidMetric = errors.New("invalid metric name")

// flushLeaseName is the lease serializing read-add-write flushes. Stats are
// per-namespace lossy; a single global flush lease is fine for the POC.
const flushLeaseName = "stats/flush"

// Ingester accumulates RecordEvent deltas in memory and flushes them to KV
// under a grab-flush-release lease. Tracked-resource and metric validation
// happen on the (cheap) RecordEvent path; misconfigured/unknown events are
// dropped and counted.
type Ingester struct {
	decls   *Declarations
	store   *Store
	leases  *lease.Manager
	dropped prometheus.Counter
	log     log.Logger

	mu  sync.Mutex
	buf map[objectRef]map[string]int64
}

func NewIngester(store *Store, decls *Declarations, leases *lease.Manager, reg prometheus.Registerer) *Ingester {
	dropped := prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: "unified_storage",
		Subsystem: "stats",
		Name:      "dropped_events_total",
		Help:      "Number of RecordEvent calls dropped (untracked resource or invalid metric).",
	})
	if reg != nil {
		reg.MustRegister(dropped)
	}
	return &Ingester{
		decls:   decls,
		store:   store,
		leases:  leases,
		dropped: dropped,
		log:     log.New("unified-storage.stats"),
		buf:     map[objectRef]map[string]int64{},
	}
}

// RecordEvent buffers a single event. Untracked resources are silently
// ignored (counted as dropped); unknown metrics return ErrInvalidMetric.
func (i *Ingester) RecordEvent(group, resource, namespace, name, metric string, count int64) error {
	decl, ok := i.decls.Lookup(group, resource)
	if !ok {
		i.dropped.Inc()
		return nil
	}
	if !decl.HasMetric(metric) {
		i.dropped.Inc()
		return ErrInvalidMetric
	}
	if count == 0 {
		return nil
	}
	o := objectRef{Group: group, Resource: resource, Namespace: namespace, Name: name}

	i.mu.Lock()
	defer i.mu.Unlock()
	if i.buf[o] == nil {
		i.buf[o] = map[string]int64{}
	}
	i.buf[o][metric] += count
	return nil
}

// drain swaps out the current buffer for flushing.
func (i *Ingester) drain() map[objectRef]map[string]int64 {
	i.mu.Lock()
	defer i.mu.Unlock()
	if len(i.buf) == 0 {
		return nil
	}
	out := i.buf
	i.buf = map[objectRef]map[string]int64{}
	return out
}

// restore re-buffers deltas that failed to flush so they are retried (additive,
// so re-merging is safe).
func (i *Ingester) restore(deltas map[objectRef]map[string]int64) {
	i.mu.Lock()
	defer i.mu.Unlock()
	for o, metrics := range deltas {
		if i.buf[o] == nil {
			i.buf[o] = map[string]int64{}
		}
		for m, v := range metrics {
			i.buf[o][m] += v
		}
	}
}

// Flush grabs the lease, drains buffered deltas, and increments today's daily
// buckets (atomic per object) plus a best-effort aggregates-cache bump. The
// lease is released immediately (grab-flush-release) so other replicas can
// take their turn. On failure deltas are re-buffered for the next flush.
func (i *Ingester) Flush(ctx context.Context) error {
	pending := i.drain()
	if len(pending) == 0 {
		return nil
	}

	l, err := i.leases.Acquire(ctx, flushLeaseName, lease.WithTTL(10*time.Second))
	if err != nil {
		// Could not get the lease (another replica is flushing). Put the
		// deltas back and try again next interval.
		i.restore(pending)
		if errors.Is(err, lease.ErrLeaseAlreadyHeld) {
			return nil
		}
		return err
	}
	defer func() { _ = i.leases.Release(ctx, l) }()

	now, err := i.store.kv.UnixTimestamp(ctx)
	if err != nil {
		i.restore(pending)
		return err
	}
	day := dayString(now)

	var firstErr error
	for o, deltas := range pending {
		updated, err := i.store.IncrementDaily(ctx, o, day, deltas)
		if err != nil {
			// Re-buffer just this object's deltas.
			i.restore(map[objectRef]map[string]int64{o: deltas})
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		// Best-effort aggregates bump so the index sees fresh values before
		// the next daily recalc; staleness self-heals on recalc.
		i.bumpAggregates(ctx, o, deltas)

		// Log the new per-day bucket totals so they can be compared against the
		// legacy dashboard_usage_by_day table (POC).
		i.log.Info("flushed usage stats",
			"group", o.Group, "resource", o.Resource,
			"namespace", o.Namespace, "name", o.Name,
			"day", day, "daily_totals", updated)
	}
	return firstErr
}

// bumpAggregates increments the cached window/total fields for an object.
// Best-effort: errors are swallowed because recalc will reconcile.
func (i *Ingester) bumpAggregates(ctx context.Context, o objectRef, deltas map[string]int64) {
	decl, ok := i.decls.Lookup(o.Group, o.Resource)
	if !ok {
		return
	}
	fields := map[string]int64{}
	for metric, delta := range deltas {
		cur, err := getInt64(ctx, i.store.kv, aggregatesSection, aggregateKey(o, totalField(metric)))
		if err != nil {
			return
		}
		fields[totalField(metric)] = cur + delta
		for _, w := range decl.Windows {
			f := aggregateField(metric, w)
			cur, err := getInt64(ctx, i.store.kv, aggregatesSection, aggregateKey(o, f))
			if err != nil {
				return
			}
			fields[f] = cur + delta
		}
	}
	_ = i.store.WriteAggregates(ctx, o, fields)
}

// RunFlushLoop flushes on an interval until the context is cancelled.
func (i *Ingester) RunFlushLoop(ctx context.Context, interval time.Duration) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			_ = i.Flush(ctx)
		}
	}
}

// FlushInterval is how often buffered deltas are written to KV. Short for the
// POC so totals show up quickly after viewing a dashboard.
const FlushInterval = 2 * time.Second

// RecalcInterval is how often windows are recomputed and expiring buckets are
// folded into overflow.
const RecalcInterval = 1 * time.Hour

// Start launches the background flush and recalc loops. They exit when ctx is
// cancelled.
func (i *Ingester) Start(ctx context.Context) {
	go i.RunFlushLoop(ctx, FlushInterval)
	go i.runRecalcLoop(ctx, RecalcInterval)
}

func (i *Ingester) runRecalcLoop(ctx context.Context, interval time.Duration) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			now, err := i.store.kv.UnixTimestamp(ctx)
			if err != nil {
				continue
			}
			_ = i.store.Recalc(ctx, i.decls, now)
		}
	}
}

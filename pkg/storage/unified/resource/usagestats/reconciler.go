package usagestats

import (
	"context"
	"errors"
	"math/rand/v2"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
)

const (
	defaultReconcileInterval = 6 * time.Hour
	maxStartupJitter         = time.Minute
)

// disableStartupReconcile is assigned to startupJitter in tests that start the
// service but don't want a reconcile of their own.
const disableStartupReconcile = -1

var errLeaseLost = errors.New("usage stats reconcile lease lost")

// outOfWindow marks a daily bucket that feeds total but no rolling window.
const outOfWindow = -1

type Reconciler struct {
	services.Service

	store   *Store
	decls   *Declarations
	leases  *lease.Manager
	metrics *reconcilerMetrics
	log     log.Logger
	now     func() time.Time

	interval      time.Duration
	startupJitter time.Duration
}

type ReconcilerOptions struct {
	Store        *Store
	Declarations *Declarations
	Leases       *lease.Manager
	Reg          prometheus.Registerer
	Log          log.Logger

	Interval time.Duration
	// Now overrides the clock for testing; defaults to time.Now.
	Now func() time.Time
}

func NewReconciler(opts ReconcilerOptions) (*Reconciler, error) {
	if opts.Store == nil {
		return nil, errors.New("usage stats reconciler requires a store")
	}
	if opts.Leases == nil {
		return nil, errors.New("usage stats reconciler requires a lease manager")
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
	interval := opts.Interval
	if interval <= 0 {
		interval = defaultReconcileInterval
	}
	logger := opts.Log
	if logger == nil {
		logger = log.New("unified-storage.usagestats.reconciler")
	}
	r := &Reconciler{
		store:         opts.Store,
		decls:         decls,
		leases:        opts.Leases,
		metrics:       newReconcilerMetrics(opts.Reg),
		log:           logger,
		now:           now,
		interval:      interval,
		startupJitter: rand.N(maxStartupJitter),
	}
	r.Service = services.NewBasicService(nil, r.running, nil)
	return r, nil
}

func (r *Reconciler) running(ctx context.Context) error {
	if r.startupJitter >= 0 {
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(r.startupJitter):
			if err := r.Reconcile(ctx); err != nil {
				r.log.Warn("usage stats reconcile failed", "error", err)
			}
		}
	}

	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			if err := r.Reconcile(ctx); err != nil {
				r.log.Warn("usage stats reconcile failed", "error", err)
			}
		}
	}
}

// Reconcile recomputes aggregates for every declared resource across all
// namespaces. It returns the first error encountered but always attempts every
// resource so one failure doesn't stall the rest.
func (r *Reconciler) Reconcile(ctx context.Context) error {
	start := r.now()
	defer func() { r.metrics.reconcileDuration.Observe(r.now().Sub(start).Seconds()) }()

	// Anchor "today" to midnight in the same representation parseDay yields for
	// bucket keys, so window comparisons are exact.
	today, err := parseDay(r.now().Format(dayLayout))
	if err != nil {
		return err
	}

	var firstErr error
	for _, decl := range r.decls.all() {
		if err := r.reconcileGroupResource(ctx, decl, newAggregator(decl, today, r.log)); err != nil {
			r.log.Error("failed to reconcile usage stats",
				"group", decl.Group, "resource", decl.Resource, "error", err)
			if firstErr == nil {
				firstErr = err
			}
		}
	}
	if firstErr != nil {
		return firstErr
	}
	r.metrics.lastSuccess.Set(float64(r.now().Unix()))
	return nil
}

func (r *Reconciler) reconcileGroupResource(ctx context.Context, decl declaration, agg *aggregator) error {
	var firstErr error
	for ns, err := range r.store.StreamNamespaces(ctx, decl.Group, decl.Resource) {
		if err != nil {
			return err
		}
		if err := ctx.Err(); err != nil {
			return err
		}
		scope := groupResourceNamespaceRef{Group: decl.Group, Resource: decl.Resource, Namespace: ns}
		err = r.reconcileNamespace(ctx, scope, agg)
		switch {
		case err == nil:
		case errors.Is(err, errLeaseLost):
			r.log.Warn("usage stats reconcile lease lost; namespace only partially reconciled",
				"group", decl.Group, "resource", decl.Resource, "namespace", ns)
		default:
			r.metrics.namespaceFailures.Inc()
			r.log.Error("failed to reconcile usage stats namespace",
				"group", decl.Group, "resource", decl.Resource, "namespace", ns, "error", err)
			if firstErr == nil {
				firstErr = err
			}
		}
	}
	return firstErr
}

func (r *Reconciler) reconcileNamespace(ctx context.Context, scope groupResourceNamespaceRef, agg *aggregator) error {
	l, err := r.leases.Acquire(ctx, scope.leaseName(), lease.WithTTL(flushLeaseTTL), lease.WithAutoRenew())
	if err != nil {
		if errors.Is(err, lease.ErrLeaseAlreadyHeld) {
			// A flush (or another reconcile) is working this namespace.
			return nil
		}
		return err
	}
	defer func() {
		if releaseErr := r.leases.Release(context.WithoutCancel(ctx), l); releaseErr != nil {
			r.log.Warn("releasing usage stats reconcile lease failed", "lease", scope.leaseName(), "error", releaseErr)
		}
	}()

	// Stream one object at a time rather than materializing every object in the
	// namespace; each object's daily bucket set is bounded (days x metrics).
	var firstErr error
	for od, err := range r.store.StreamObjectDailies(ctx, scope.Group, scope.Resource, scope.Namespace) {
		if err != nil {
			return err
		}
		if err := ctx.Err(); err != nil {
			return err
		}

		select {
		case <-l.Lost():
			r.metrics.leasesLost.Inc()
			// A real write failure outranks the lost lease: it needs the
			// louder log and the failure counter.
			if firstErr != nil {
				return firstErr
			}
			return errLeaseLost
		default:
		}

		if err := r.store.WriteAggregates(ctx, od.Ref, agg.compute(od)); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

// aggregator derives the aggregates cache for an object from its daily buckets
// (day -> metric -> value, including the overflow bucket):
//
//   - total = overflow + sum of every dated bucket
//   - last_N_days = sum of buckets in the inclusive range [today-(N-1), today]
//
// Everything that depends only on the declaration and the current day (field
// names, metric positions) is computed once here rather than per object, and the
// per-object counters are reused across objects. One aggregator therefore serves
// a whole pass over a resource and must be used sequentially, which is how
// reconcile walks namespaces.
type aggregator struct {
	decl  declaration
	today time.Time
	log   log.Logger

	// Scratch, zeroed per object, indexed by a metric's position in
	// decl.Metrics (for dashboards 0 is views, 1 queries, 2 errors). counts is
	// further indexed by a bucket's age in days, which is why a declaration may
	// not ask for a window beyond MaxWindow.
	totals []uint64
	counts [][MaxWindow]uint64
}

func newAggregator(decl declaration, today time.Time, logger log.Logger) *aggregator {
	return &aggregator{
		decl:   decl,
		today:  today,
		log:    logger,
		totals: make([]uint64, len(decl.Metrics)),
		counts: make([][MaxWindow]uint64, len(decl.Metrics)),
	}
}

// compute emits every metric/window/total field, so a stale (over-counted)
// aggregate is corrected back down to the true value on write.
func (a *aggregator) compute(od ObjectDaily) map[string]uint64 {
	clear(a.totals)
	clear(a.counts)

	var invalidDays int
	for day, metrics := range od.Daily {
		// age is the bucket's age in days, or outOfWindow for buckets that feed
		// total but no window: the overflow bucket, days older than every
		// window, unparseable days, and future days from clock skew.
		age := outOfWindow
		if day != overflowBucket {
			d, err := parseDay(day)
			switch {
			case err != nil:
				invalidDays++
			default:
				if days := int(a.today.Sub(d) / (24 * time.Hour)); days >= 0 && days < MaxWindow {
					age = days
				}
			}
		}
		for metric, v := range metrics {
			i, ok := a.decl.index(metric)
			if !ok {
				// Metric dropped from the declaration; its fields are gone too.
				continue
			}
			a.totals[i] += v
			if age != outOfWindow {
				a.counts[i][age] += v
			}
		}
	}
	if invalidDays > 0 {
		a.log.Warn("skipped unparseable daily buckets while reconciling usage stats",
			"group", od.Ref.Group, "resource", od.Ref.Resource,
			"namespace", od.Ref.Namespace, "name", od.Ref.Name, "buckets", invalidDays)
	}

	fields := make(map[string]uint64, len(a.decl.Metrics)*(len(a.decl.Windows)+1))
	for i := range a.decl.Metrics {
		fields[a.decl.fields.totals[i]] = a.totals[i]
		// prefix[n] is the sum of the n most recent days, so last_N_days is
		// prefix[N]. One pass per metric serves every window, and makes
		// last_1 <= last_7 <= last_30 true by construction.
		var prefix [MaxWindow + 1]uint64
		for days, v := range a.counts[i] {
			prefix[days+1] = prefix[days] + v
		}
		for j, w := range a.decl.Windows {
			fields[a.decl.fields.windows[i][j]] = prefix[w]
		}
	}
	return fields
}

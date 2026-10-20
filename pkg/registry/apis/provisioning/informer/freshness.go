package informer

import (
	"context"
	"strconv"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	apimeta "k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Measures whether a reconcile read that follows a NATS notification observes
// the version that notification announced. Instrumentation only: results pass
// through untouched and nothing here feeds a retry or cache decision.
//
// Two legal executions are excluded by construction, so a non-zero behind count
// cannot be explained away as ordinary concurrency:
//
//   - the announcement is sampled before the read is issued, because a read
//     already in flight when a newer write commits may return the earlier state;
//   - a NotFound is never counted as behind, because an object deleted after its
//     announcement is correctly absent and the DELETED proving it may be
//     round-robined to another replica.

const (
	// Only a read taken soon after an announcement says anything about
	// visibility, so entries whose next event lands on another replica age out
	// instead of accumulating.
	announcementTTL = 15 * time.Minute
	// Expiry is amortized over the event stream rather than paid per call.
	announcementSweep = time.Minute
)

// announcements remembers, per object, the newest resource version a live
// notification has announced to this replica.
type announcements struct {
	mu        sync.Mutex
	seen      map[string]announcement
	lastSweep time.Time
	now       func() time.Time // injected in tests
}

type announcement struct {
	rv   int64
	seen time.Time
}

func newAnnouncements() *announcements {
	return &announcements{seen: map[string]announcement{}, now: time.Now}
}

var _ usinformer.Announcements = (*announcements)(nil)

// Announce keeps the newest version seen for the key and refreshes its age.
func (a *announcements) Announce(namespace, name string, rv int64) {
	if rv <= 0 {
		return
	}
	// Wire versions are snowflakes, but a row unwritten since the migration
	// reads back as legacy microseconds; normalize so the two compare.
	rv = resource.ToSnowflakeRV(rv)
	a.mu.Lock()
	defer a.mu.Unlock()
	a.sweepLocked()
	key := announcementKey(namespace, name)
	e := a.seen[key]
	if rv > e.rv {
		e.rv = rv
	}
	e.seen = a.now()
	a.seen[key] = e
}

// Forget drops the key: the object is gone, so no read is expected to reach a
// version for it. A delete older than the outstanding announcement is kept out:
// notifications for one key can come from different storage replicas, so a
// delete can arrive after the re-create that superseded it, and erasing the
// newer version would stop counting the reads it was there to judge. An
// undatable delete (rv <= 0) drops the key, which can only under-count.
func (a *announcements) Forget(namespace, name string, rv int64) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.sweepLocked()
	key := announcementKey(namespace, name)
	if e, ok := a.seen[key]; ok && rv > 0 && e.rv > resource.ToSnowflakeRV(rv) {
		return
	}
	delete(a.seen, key)
}

// Announced returns the newest version announced for the key, or 0 when none is
// outstanding. Expiry is enforced here too, so an entry cannot outlive the TTL
// on an informer too quiet to sweep.
func (a *announcements) Announced(namespace, name string) int64 {
	a.mu.Lock()
	defer a.mu.Unlock()
	key := announcementKey(namespace, name)
	e, ok := a.seen[key]
	if !ok {
		return 0
	}
	if a.now().Sub(e.seen) > announcementTTL {
		delete(a.seen, key)
		return 0
	}
	return e.rv
}

func (a *announcements) sweepLocked() {
	now := a.now()
	if now.Sub(a.lastSweep) < announcementSweep {
		return
	}
	a.lastSweep = now
	for k, e := range a.seen {
		if now.Sub(e.seen) > announcementTTL {
			delete(a.seen, k)
		}
	}
}

func announcementKey(namespace, name string) string {
	return namespace + "/" + name
}

// Values of the outcome label. behind is the one the storage contract says
// cannot happen; not_found is ambiguous and kept apart from it.
const (
	outcomeCurrent  = "current"
	outcomeBehind   = "behind"
	outcomeNotFound = "not_found"
)

// FreshnessMetrics reports how reconcile reads compare against the notification
// that triggered them:
//
//	grafana_provisioning_reconcile_read_freshness_total{resource,outcome}
//	grafana_provisioning_reconcile_read_version_lag_seconds{resource}
//
// Only reads with an announcement outstanding are counted, so the three
// outcomes sum to that population and behind/(current+behind) is the rate at
// which such a read missed the announced write.
//
// It also carries the one outcome of acting on that measurement (see
// staleread.go), since it is the same subject and the same lifecycle:
//
//	grafana_provisioning_stale_reads_exhausted_total{resource}
type FreshnessMetrics struct {
	reads     *prometheus.CounterVec
	lag       *prometheus.HistogramVec
	exhausted *prometheus.CounterVec
}

// NewFreshnessMetrics builds the read-freshness metrics on reg. Build it once
// per process and hand it to each delta source: the collectors are shared across
// resources and told apart by the resource label, so building them per delta
// source would register a duplicate. A nil reg leaves them unregistered; a nil
// *FreshnessMetrics yields discarding recorders.
func NewFreshnessMetrics(reg prometheus.Registerer) *FreshnessMetrics {
	return &FreshnessMetrics{
		reads: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_reconcile_read_freshness_total",
			Help: "Reconcile reads taken while a live notification for the same object was outstanding, by resource and outcome: current (at or above the announced resource version), behind (below it — the read missed a write already announced to this replica), not_found (absent, which is also correct for an object deleted after the announcement).",
		}, []string{"resource", "outcome"}),
		lag: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "grafana_provisioning_reconcile_read_version_lag_seconds",
			Help:                            "How far behind a reconcile read came back: the time between the announced resource version and the older one the read observed.",
			Buckets:                         prometheus.ExponentialBuckets(0.005, 4, 8),
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"resource"}),
		exhausted: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_stale_reads_exhausted_total",
			Help: "Reconcile reads that stayed behind the announced resource version for a whole re-read budget and were surrendered to the work queue, by resource. Retries are not counted separately: the behind outcome above is recorded per attempt, so behind = re-reads + exhausted budgets.",
		}, []string{"resource"}),
	}
}

// Recorder binds the metrics to one kind. It creates all three outcome series
// at zero, so "nothing came back behind" reads as a flat zero rather than as an
// absent series.
func (m *FreshnessMetrics) Recorder(resourceName string) FreshnessRecorder {
	if m == nil {
		return FreshnessRecorder{}
	}
	return FreshnessRecorder{
		resourceName: resourceName,
		current:      m.reads.WithLabelValues(resourceName, outcomeCurrent),
		behind:       m.reads.WithLabelValues(resourceName, outcomeBehind),
		notFound:     m.reads.WithLabelValues(resourceName, outcomeNotFound),
		lag:          m.lag.WithLabelValues(resourceName),
		exhausted:    m.exhausted.WithLabelValues(resourceName),
	}
}

// FreshnessRecorder records one kind's read-freshness observations. Its zero
// value discards.
type FreshnessRecorder struct {
	resourceName string
	current      prometheus.Counter
	behind       prometheus.Counter
	notFound     prometheus.Counter
	lag          prometheus.Observer
	exhausted    prometheus.Counter
}

// recordExhausted counts a read that never caught up with the announced version.
func (r FreshnessRecorder) recordExhausted() {
	if r.exhausted != nil {
		r.exhausted.Inc()
	}
}

// observe records one read against the version announced before it was issued
// (normalized, as announcements.Announced returns it; 0 means none was
// outstanding). Reads with nothing to compare against, failures other than
// NotFound, and unparseable versions are not counted.
func (r FreshnessRecorder) observe(ctx context.Context, namespace, name string, announced int64, obj runtime.Object, err error) {
	if r.current == nil || announced <= 0 {
		return
	}
	switch {
	case apierrors.IsNotFound(err):
		r.notFound.Inc()
	case err != nil:
		return
	default:
		rv := objectSnowflakeRV(obj)
		if rv == 0 {
			return
		}
		if rv >= announced {
			r.current.Inc()
			return
		}
		r.behind.Inc()
		// Zero included: two versions from the same millisecond differ only in
		// the sequence bits, and dropping those would leave the histogram empty
		// while the counter climbed. Both versions are snowflakes with
		// rv < announced, so the lag cannot be negative.
		lag := resource.ResourceVersionTime(announced).Sub(resource.ResourceVersionTime(rv)).Seconds()
		r.lag.Observe(lag)
		// The counter says the premise was contradicted; this says which write,
		// so it can be matched against the storage logs.
		logging.FromContext(ctx).Warn("reconcile read observed an older version than the notification that triggered it",
			"resource", r.resourceName, "namespace", namespace, "name", name,
			"announced", announced, "observed", rv, "lagSeconds", lag)
	}
}

// objectSnowflakeRV parses an object's resource version into the space
// announcements are stored in; 0 when it does not parse.
func objectSnowflakeRV(obj runtime.Object) int64 {
	acc, err := apimeta.Accessor(obj)
	if err != nil {
		return 0
	}
	rv, err := strconv.ParseInt(acc.GetResourceVersion(), 10, 64)
	if err != nil || rv <= 0 {
		return 0
	}
	return resource.ToSnowflakeRV(rv)
}

// announcedVersions is the read side of announcements, so a getter takes only
// what it uses.
type announcedVersions interface {
	Announced(namespace, name string) int64
}

// observeRepositoryFreshness wraps a RepositoryGetter to record how each read
// compared to the notification that triggered it. Calls pass through untouched.
//
// It returns the concrete wrapper so a caller that must reach its own verdict
// about the same read can share the sample it took (see getAt).
func observeRepositoryFreshness(inner RepositoryGetter, announced announcedVersions, rec FreshnessRecorder) freshnessRepositoryGetter {
	return freshnessRepositoryGetter{RepositoryGetter: inner, announced: announced, rec: rec}
}

type freshnessRepositoryGetter struct {
	RepositoryGetter
	announced announcedVersions
	rec       FreshnessRecorder
}

func (g freshnessRepositoryGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error) {
	// Sampled before the read; see the top of the file.
	return g.getAt(ctx, namespace, name, g.announced.Announced(namespace, name))
}

// getAt is Get against a version the caller already sampled before the read. A
// caller that acts on this comparison (see staleread.go) has to judge the read
// against the same sample this records it against: two samples taken around one
// read can straddle an announcement, and would then disagree about it.
func (g freshnessRepositoryGetter) getAt(ctx context.Context, namespace, name string, announced int64) (*provisioningapis.Repository, error) {
	repo, err := g.RepositoryGetter.Get(ctx, namespace, name)
	g.rec.observe(ctx, namespace, name, announced, repo, err)
	return repo, err
}

// observeConnectionFreshness is observeRepositoryFreshness for connections.
func observeConnectionFreshness(inner ConnectionGetter, announced announcedVersions, rec FreshnessRecorder) freshnessConnectionGetter {
	return freshnessConnectionGetter{ConnectionGetter: inner, announced: announced, rec: rec}
}

type freshnessConnectionGetter struct {
	ConnectionGetter
	announced announcedVersions
	rec       FreshnessRecorder
}

func (g freshnessConnectionGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Connection, error) {
	return g.getAt(ctx, namespace, name, g.announced.Announced(namespace, name))
}

// getAt is Get against an already-sampled version; see freshnessRepositoryGetter.getAt.
func (g freshnessConnectionGetter) getAt(ctx context.Context, namespace, name string, announced int64) (*provisioningapis.Connection, error) {
	conn, err := g.ConnectionGetter.Get(ctx, namespace, name)
	g.rec.observe(ctx, namespace, name, announced, conn, err)
	return conn, err
}

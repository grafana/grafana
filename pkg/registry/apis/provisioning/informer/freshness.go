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

// Under the NATS informers a reconcile reads the object it reconciles straight
// from the API, and the notification that woke it carries the resource version
// of the write that caused it. Unified storage publishes that notification only
// after the write is committed and a latest GET reads the data store directly,
// so a read the worker starts *after* the notification was delivered here is
// expected to observe that version or newer. Whether it always does is an open
// question: the storage team's contract says yes, operational experience has
// suggested otherwise, and no production signal exists either way today.
//
// This is that signal, and nothing more: the read path is unchanged, every
// result is returned exactly as the API produced it, and no retry, error or
// cache decision is derived from what is recorded.
//
// It is built to produce evidence that survives scrutiny, so it only counts
// against the premise in the one execution where the premise cannot be excused:
//
//   - the announcement is sampled *before* the read is issued. A read already in
//     flight when a newer write commits may legally return the earlier state, so
//     comparing against an announcement that landed mid-read would manufacture
//     disagreement out of ordinary concurrency;
//   - a NotFound is never counted as a lagging read. An object announced at rv
//     and deleted straight after is correctly absent, and under the round-robin
//     queue group the delete that proves it may be delivered to a different
//     replica; such a 404 gets its own, explicitly ambiguous outcome rather than
//     being folded into the anomaly it resembles;
//   - every read counted as behind is also logged with both versions, so a
//     non-zero counter can be taken apart into concrete objects and timestamps
//     instead of being argued about in the abstract.

const (
	// announcementTTL bounds how long an announcement is remembered. Only a
	// read that follows the announcement closely can say anything about read
	// visibility; an entry nobody reads again — because the live ADDED for the
	// next change went to another replica, or the object was hard-deleted and
	// the DELETED was routed elsewhere — ages out rather than accumulating.
	announcementTTL = 15 * time.Minute
	// announcementSweep is the minimum interval between the expiry scans that
	// recorded announcements amortize over the event stream, so TTL costs
	// nothing per call.
	announcementSweep = time.Minute
)

// announcements remembers, per object, the highest resource version a live
// notification has announced to this replica, with a TTL. It implements
// usinformer.Announcements, and is read only by the freshness instrumentation
// on the getters.
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

// Announce records rv for the key when it is the newest version announced so
// far, refreshing the entry's age either way.
func (a *announcements) Announce(namespace, name string, rv int64) {
	if rv <= 0 {
		return
	}
	// Wire versions are snowflakes; a read of a row unwritten since the
	// migration can still carry a legacy microsecond value. Normalizing on the
	// way in keeps both in one comparable space.
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

// Forget drops the key: its object is gone from storage, so there is no version
// a subsequent read is expected to reach.
func (a *announcements) Forget(namespace, name string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.sweepLocked()
	delete(a.seen, announcementKey(namespace, name))
}

// Announced returns the newest version announced for the key, or 0 when none is
// outstanding — including one past its TTL, which is dropped on the way out so
// an entry cannot outlive the TTL just because the informer is too quiet to
// sweep.
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

// Freshness outcomes, the values of the outcome label.
const (
	// outcomeCurrent: the read observed the announced version or newer. The
	// expected result.
	outcomeCurrent = "current"
	// outcomeBehind: the read returned an object strictly older than a version
	// already announced to this replica before the read was issued. This is the
	// outcome the premise says cannot happen.
	outcomeBehind = "behind"
	// outcomeNotFound: the read returned NotFound with an announcement
	// outstanding. Ambiguous by construction: the object may have been deleted
	// after the announcement, with the DELETED that would have cleared it
	// round-robined to another replica. Counted separately and never read as
	// evidence of a lagging read.
	outcomeNotFound = "not_found"
)

// FreshnessMetrics reports how reconcile reads compare against the
// notification that triggered them:
//
//	grafana_provisioning_reconcile_read_freshness_total{resource,outcome}
//	grafana_provisioning_reconcile_read_version_lag_seconds{resource}
//
// Only reads taken with an announcement outstanding are counted — there is
// nothing to compare the rest against — so current+behind+not_found is the
// population of "read that followed a live notification for the same object",
// and behind/(current+behind) is the rate at which such a read failed to
// observe the announced write. The histogram sizes those failures, in the write
// timestamps the resource versions embed, so an anomaly can be told apart from
// a rounding artefact.
type FreshnessMetrics struct {
	reads *prometheus.CounterVec
	lag   *prometheus.HistogramVec
}

// NewFreshnessMetrics builds the read-freshness metrics on reg. Build it once
// per process and hand it to each delta source: the collectors are shared across
// resources and told apart by the resource label, so registering them per delta
// source would be a duplicate registration. A nil reg leaves them unregistered;
// a nil *FreshnessMetrics yields discarding recorders.
func NewFreshnessMetrics(reg prometheus.Registerer) *FreshnessMetrics {
	return &FreshnessMetrics{
		reads: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_reconcile_read_freshness_total",
			Help: "Reconcile reads taken while a live notification for the same object was outstanding, by resource and how the read compared to the announced resource version: current (at or above it), behind (strictly below it — the read did not observe a write already announced to this replica before the read started), not_found (absent, which is also the correct result for an object deleted after the announcement).",
		}, []string{"resource", "outcome"}),
		lag: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "grafana_provisioning_reconcile_read_version_lag_seconds",
			Help:                            "For reconcile reads that came back behind, how far: the time between the announced resource version and the older version the read observed, from the write timestamps the versions embed.",
			Buckets:                         prometheus.ExponentialBuckets(0.005, 4, 8),
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"resource"}),
	}
}

// Recorder binds the metrics to one kind, resolving the label values once. It
// creates all three outcome series at zero, so "no reads came back behind" is
// visible as a flat zero rather than as an absent series.
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
}

// observe records one read against the version announced before it was issued
// (announced is in the normalized space announcements.Announced returns; 0 means
// nothing was outstanding). Reads with no announcement outstanding, failures
// other than NotFound, and objects whose version does not parse are not counted:
// none of them can say anything about read visibility.
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
		lag := resource.ResourceVersionTime(announced).Sub(resource.ResourceVersionTime(rv)).Seconds()
		if lag > 0 {
			r.lag.Observe(lag)
		}
		// Logged as well as counted: the counter says the premise was
		// contradicted, this says which object, when, and by how far — the part
		// that can be checked against the storage logs for the same write.
		logging.FromContext(ctx).Warn("reconcile read observed an older version than the notification that triggered it",
			"resource", r.resourceName, "namespace", namespace, "name", name,
			"announced", announced, "observed", rv, "lagSeconds", lag)
	}
}

// objectSnowflakeRV parses an object's resource version normalized to snowflake
// form, the space announcements are stored in; 0 when it does not parse.
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

// announcedVersions is the read side of announcements, so the getters take only
// what they use (and tests can substitute a fixed version).
type announcedVersions interface {
	Announced(namespace, name string) int64
}

// observeRepositoryFreshness wraps a RepositoryGetter to record how each
// reconcile read compared to the notification that triggered it. Every call is
// passed through untouched — the wrapper decides nothing.
func observeRepositoryFreshness(inner RepositoryGetter, announced announcedVersions, rec FreshnessRecorder) RepositoryGetter {
	return freshnessRepositoryGetter{RepositoryGetter: inner, announced: announced, rec: rec}
}

type freshnessRepositoryGetter struct {
	RepositoryGetter
	announced announcedVersions
	rec       FreshnessRecorder
}

func (g freshnessRepositoryGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error) {
	// Sampled before the read is issued; see the file comment.
	announced := g.announced.Announced(namespace, name)
	repo, err := g.RepositoryGetter.Get(ctx, namespace, name)
	g.rec.observe(ctx, namespace, name, announced, repo, err)
	return repo, err
}

// observeConnectionFreshness is observeRepositoryFreshness for connections.
func observeConnectionFreshness(inner ConnectionGetter, announced announcedVersions, rec FreshnessRecorder) ConnectionGetter {
	return freshnessConnectionGetter{ConnectionGetter: inner, announced: announced, rec: rec}
}

type freshnessConnectionGetter struct {
	ConnectionGetter
	announced announcedVersions
	rec       FreshnessRecorder
}

func (g freshnessConnectionGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Connection, error) {
	announced := g.announced.Announced(namespace, name)
	conn, err := g.ConnectionGetter.Get(ctx, namespace, name)
	g.rec.observe(ctx, namespace, name, announced, conn, err)
	return conn, err
}

package informer

import (
	"strconv"
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/tools/cache"

	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// informerMetrics measures event delivery into the provisioning controllers'
// delta source — the NATS-backed informer or the apiserver watch, whichever the
// process runs. It records how many events arrived — live vs recovered by the
// periodic re-list/resync, as separate metric families — and how long after the
// change was written. Events a replica missed live cannot be counted here —
// under the round-robin queue group each notification reaches one replica, so a
// per-replica gap measures routing, not loss. Missed NATS events are the
// cluster-wide difference between the publisher's
// storage_server_watch_notifications_published_total and live_events_total
// summed across replicas.
type informerMetrics struct {
	liveEvents    *prometheus.CounterVec
	relistEvents  *prometheus.CounterVec
	liveLatency   *prometheus.HistogramVec
	relistLatency *prometheus.HistogramVec
}

// newInformerMetrics builds the delivery metrics on reg. One instance serves
// every recorder in a delta source, which pass their own resource label, so a
// process builds this once per delta source. A nil reg leaves the collectors
// unregistered.
func newInformerMetrics(reg prometheus.Registerer) *informerMetrics {
	latencyOpts := func(name, help string) prometheus.HistogramOpts {
		return prometheus.HistogramOpts{
			Name:                            name,
			Help:                            help,
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}
	}
	return &informerMetrics{
		liveEvents: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_informer_live_events_total",
			Help: "Events delivered live to provisioning informer handlers, by resource and verb.",
		}, []string{"resource", "verb"}),
		relistEvents: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_informer_relist_events_total",
			Help: "Events delivered by the periodic re-list/resync to provisioning informer handlers, by resource and verb. Adds and deletes are changes the live stream did not deliver here; updates are re-deliveries of unchanged objects.",
		}, []string{"resource", "verb"}),
		liveLatency: promauto.With(reg).NewHistogramVec(latencyOpts(
			"grafana_provisioning_informer_live_event_latency_seconds",
			"Time from a change's resource version being issued to its live event reaching the informer handlers.",
		), []string{"resource"}),
		relistLatency: promauto.With(reg).NewHistogramVec(latencyOpts(
			"grafana_provisioning_informer_relist_event_latency_seconds",
			"Time from a change's resource version being issued to its recovery by a re-list, for adds the live stream did not deliver. Re-deliveries of unchanged objects carry no latency.",
		), []string{"resource"}),
	}
}

func (m *informerMetrics) observeLive(resourceName, verb string, rv int64) {
	m.liveEvents.WithLabelValues(resourceName, verb).Inc()
	m.observeLatency(m.liveLatency, resourceName, rv)
}

func (m *informerMetrics) observeRelist(resourceName, verb string, rv int64) {
	m.relistEvents.WithLabelValues(resourceName, verb).Inc()
	m.observeLatency(m.relistLatency, resourceName, rv)
}

func (m *informerMetrics) observeLatency(latency *prometheus.HistogramVec, resourceName string, rv int64) {
	if rv <= 0 {
		return
	}
	// The RV embeds the write's timestamp (snowflake or microsecond epoch);
	// negative results mean clock skew, not delivery, so they are dropped.
	seconds := time.Since(resource.ResourceVersionTime(rv)).Seconds()
	if seconds > 0 {
		latency.WithLabelValues(resourceName).Observe(seconds)
	}
}

// apiServerMeter observes deliveries from an apiserver-backed
// SharedIndexInformer. Register it as one extra event handler so each event is
// counted once however many controller handlers the informer has. The informer has no live/relist
// distinction of its own, so the meter derives it: initial-list adds and resync
// re-deliveries (same RV on both sides of an update) and re-list-detected
// deletes (DeletedFinalStateUnknown) count as relist, everything else came from
// the watch and counts as live.
type apiServerMeter struct {
	metrics      *informerMetrics
	resourceName string
}

var _ cache.ResourceEventHandler = apiServerMeter{}

func (h apiServerMeter) OnAdd(obj any, isInInitialList bool) {
	if isInInitialList {
		// Initial-list objects may be arbitrarily old: no latency sample.
		h.metrics.observeRelist(h.resourceName, usinformer.VerbAdd, 0)
		return
	}
	h.metrics.observeLive(h.resourceName, usinformer.VerbAdd, objectRV(obj))
}

func (h apiServerMeter) OnUpdate(oldObj, newObj any) {
	// A resync replays the store's object against itself; a live update always
	// carries a new RV.
	if objectRVString(oldObj) == objectRVString(newObj) {
		h.metrics.observeRelist(h.resourceName, usinformer.VerbUpdate, 0)
		return
	}
	h.metrics.observeLive(h.resourceName, usinformer.VerbUpdate, objectRV(newObj))
}

func (h apiServerMeter) OnDelete(obj any) {
	if _, missedDelete := obj.(cache.DeletedFinalStateUnknown); missedDelete {
		// The delete was detected by a re-list; the carried object's RV predates
		// the delete, so it cannot date it.
		h.metrics.observeRelist(h.resourceName, usinformer.VerbDelete, 0)
		return
	}
	h.metrics.observeLive(h.resourceName, usinformer.VerbDelete, objectRV(obj))
}

func objectRVString(obj any) string {
	acc, err := meta.Accessor(obj)
	if err != nil {
		return ""
	}
	return acc.GetResourceVersion()
}

// objectRV parses an object's resource version as the int64 unified storage
// issues; 0 when absent or not numeric (no latency sample).
func objectRV(obj any) int64 {
	rv, err := strconv.ParseInt(objectRVString(obj), 10, 64)
	if err != nil {
		return 0
	}
	return rv
}

// RelistProjectionMetrics reports how the periodic re-list was served. Build it
// once per process and hand it to each delta source: the collectors are shared
// across resources and told apart by labels, so registering them per delta source
// would be a duplicate registration.
type RelistProjectionMetrics struct {
	projections *prometheus.CounterVec
}

// NewRelistProjectionMetrics builds the projection metrics on reg. A nil reg
// leaves the collectors unregistered.
func NewRelistProjectionMetrics(reg prometheus.Registerer) *RelistProjectionMetrics {
	return &RelistProjectionMetrics{
		projections: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_informer_relist_projection_total",
			Help: "Re-lists by what the server returned: keys is the keys-only projection (identities, no object bodies), objects is the full list. Reports whether keys_only_relist took effect, and shows the fallback when a server does not serve the projection.",
		}, []string{"group", "resource", "projection"}),
	}
}

// Recorder binds the metrics to one kind, resolving the label values once. It
// also creates the series at zero, so the fallback counter is visible before
// anything falls back.
func (m *RelistProjectionMetrics) Recorder(gvr schema.GroupVersionResource) RelistRecorder {
	if m == nil {
		return RelistRecorder{}
	}
	return RelistRecorder{
		keys:    m.projections.WithLabelValues(gvr.Group, gvr.Resource, "keys"),
		objects: m.projections.WithLabelValues(gvr.Group, gvr.Resource, "objects"),
	}
}

// RelistRecorder records one kind's re-list outcomes. Its zero value discards.
type RelistRecorder struct {
	keys    prometheus.Counter
	objects prometheus.Counter
}

// Projection records which projection served one re-list.
func (r RelistRecorder) Projection(keysOnly bool) {
	counter := r.objects
	if keysOnly {
		counter = r.keys
	}
	if counter != nil {
		counter.Inc()
	}
}

package informer

import (
	"errors"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/api/meta"
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
	liveEvents        *prometheus.CounterVec
	relistEvents      *prometheus.CounterVec
	liveLatency       *prometheus.HistogramVec
	relistLatency     *prometheus.HistogramVec
	reconnects        *prometheus.CounterVec
	natsSubscriptions prometheus.Gauge
	relistRequests    *prometheus.CounterVec
}

// newInformerMetrics builds the delivery metrics on reg, reusing collectors
// already registered there so every delta source in the process shares one set.
// A nil reg leaves the collectors unregistered.
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
		liveEvents: registerOrReuse(reg, prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_informer_live_events_total",
			Help: "Events delivered live to provisioning informer handlers, by resource and verb.",
		}, []string{"resource", "verb"})),
		relistEvents: registerOrReuse(reg, prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_informer_relist_events_total",
			Help: "Events delivered by the periodic re-list/resync to provisioning informer handlers, by resource and verb. Adds and deletes are changes the live stream did not deliver here; updates are re-deliveries of unchanged objects.",
		}, []string{"resource", "verb"})),
		liveLatency: registerOrReuse(reg, prometheus.NewHistogramVec(latencyOpts(
			"grafana_provisioning_informer_live_event_latency_seconds",
			"Time from a change's resource version being issued to its live event reaching the informer handlers.",
		), []string{"resource"})),
		relistLatency: registerOrReuse(reg, prometheus.NewHistogramVec(latencyOpts(
			"grafana_provisioning_informer_relist_event_latency_seconds",
			"Time from a change's resource version being issued to its recovery by a re-list, for adds the live stream did not deliver. Re-deliveries of unchanged objects carry no latency.",
		), []string{"resource"})),
		reconnects: registerOrReuse(reg, prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_informer_nats_reconnects_total",
			Help: "Times an informer's NATS subscription was (re)established after a gap. Live events published during the gap never reach this replica; the informer forces a re-list to recover them.",
		}, []string{"resource"})),
		natsSubscriptions: registerOrReuse(reg, prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "grafana_provisioning_informer_nats_subscriptions",
			Help: "Number of provisioning informers currently holding an open live NATS subscription. Below the running informer count means some run re-list-only — before their subscription first opens, or in degraded-start mode. Mid-run connection outages are reported by grafana_nats_subscriber_connection_status instead — the subscription itself resumes transparently on reconnect. Always 0 on the apiserver watch path, which has no NATS subscription.",
		})),
		relistRequests: registerOrReuse(reg, prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_informer_relist_requests_total",
			Help: "LIST API requests the re-list issued, one per page followed (unified storage caps a page at 500 items / 2 MB). Divided by the number of re-lists it is the average page count per snapshot; a rising ratio means the resource is outgrowing a single page. Recorded on the NATS informer path only — the apiserver watch lists via client-go internally.",
		}, []string{"resource"})),
	}
}

// registerOrReuse registers c on reg, returning the collector already
// registered under the same descriptor when there is one — several delta
// sources built against the same registry share one set of collectors. A nil
// reg returns c unregistered.
func registerOrReuse[C prometheus.Collector](reg prometheus.Registerer, c C) C {
	if reg == nil {
		return c
	}
	if err := reg.Register(c); err != nil {
		are := prometheus.AlreadyRegisteredError{}
		if errors.As(err, &are) {
			return are.ExistingCollector.(C)
		}
		panic(err)
	}
	return c
}

func (m *informerMetrics) observeLive(resourceName, verb string, rv int64) {
	m.liveEvents.WithLabelValues(resourceName, verb).Inc()
	m.observeLatency(m.liveLatency, resourceName, rv)
}

func (m *informerMetrics) observeRelist(resourceName, verb string, rv int64) {
	m.relistEvents.WithLabelValues(resourceName, verb).Inc()
	m.observeLatency(m.relistLatency, resourceName, rv)
}

func (m *informerMetrics) observeRelistRequest(resourceName string) {
	m.relistRequests.WithLabelValues(resourceName).Inc()
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

// natsRecorder adapts informerMetrics to the NATS informer's metrics hook,
// labelling everything it observes with one resource.
type natsRecorder struct {
	metrics      *informerMetrics
	resourceName string
	// subscribed dedupes the informer's open/close notifications so this recorder
	// moves the shared natsSubscriptions gauge by at most one, however many times
	// the informer reports the same state.
	subscribed *atomic.Bool
}

// newNATSRecorder builds a recorder for one informer. Each recorder owns its own
// subscribed state; they share metrics so the gauge totals across informers.
func newNATSRecorder(metrics *informerMetrics, resourceName string) natsRecorder {
	return natsRecorder{metrics: metrics, resourceName: resourceName, subscribed: &atomic.Bool{}}
}

var _ usinformer.Metrics = natsRecorder{}

func (r natsRecorder) ObserveLiveEvent(verb string, rv int64) {
	r.metrics.observeLive(r.resourceName, verb, rv)
}

func (r natsRecorder) ObserveRelistEvent(verb string, rv int64) {
	r.metrics.observeRelist(r.resourceName, verb, rv)
}

func (r natsRecorder) ObserveReconnect() {
	r.metrics.reconnects.WithLabelValues(r.resourceName).Inc()
}

func (r natsRecorder) ObserveLiveSubscription(open bool) {
	if open {
		if r.subscribed.CompareAndSwap(false, true) {
			r.metrics.natsSubscriptions.Inc()
		}
		return
	}
	if r.subscribed.CompareAndSwap(true, false) {
		r.metrics.natsSubscriptions.Dec()
	}
}

// apiServerMeter observes deliveries from an apiserver-backed
// SharedIndexInformer on the same series the NATS recorder writes. Register it
// as one extra event handler so each event is counted once however many
// controller handlers the informer has. The informer has no live/relist
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

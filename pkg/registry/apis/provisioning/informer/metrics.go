package informer

import (
	"errors"
	"strconv"
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/client-go/tools/cache"

	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Source label values: which delta source delivered the event.
const (
	sourceNATS      = "nats"
	sourceAPIServer = "apiserver"
)

// informerMetrics measures event delivery into the provisioning controllers'
// delta sources, on the same series for both sources so NATS and the apiserver
// watch compare directly: how many events arrived — live vs recovered by the
// periodic re-list/resync, as separate metric families — and how long after the
// change was written. Events a replica missed live cannot be counted here —
// under the round-robin queue group each notification reaches one replica, so a
// per-replica gap measures routing, not loss. Missed NATS events are the
// cluster-wide difference between the publisher's
// storage_server_watch_notifications_published_total and live_events_total
// summed across replicas.
type informerMetrics struct {
	liveEvents       *prometheus.CounterVec
	relistEvents     *prometheus.CounterVec
	liveLatency      *prometheus.HistogramVec
	relistLatency    *prometheus.HistogramVec
	reconnects       *prometheus.CounterVec
	liveSubscription *prometheus.GaugeVec
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
			Help: "Events delivered live to provisioning informer handlers, by resource, source (nats, apiserver) and verb.",
		}, []string{"resource", "source", "verb"})),
		relistEvents: registerOrReuse(reg, prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_informer_relist_events_total",
			Help: "Events delivered by the periodic re-list/resync to provisioning informer handlers, by resource, source (nats, apiserver) and verb. Adds and deletes are changes the live stream did not deliver here; updates are re-deliveries of unchanged objects.",
		}, []string{"resource", "source", "verb"})),
		liveLatency: registerOrReuse(reg, prometheus.NewHistogramVec(latencyOpts(
			"grafana_provisioning_informer_live_event_latency_seconds",
			"Time from a change's resource version being issued to its live event reaching the informer handlers.",
		), []string{"resource", "source"})),
		relistLatency: registerOrReuse(reg, prometheus.NewHistogramVec(latencyOpts(
			"grafana_provisioning_informer_relist_event_latency_seconds",
			"Time from a change's resource version being issued to its recovery by a re-list, for adds the live stream did not deliver. Re-deliveries of unchanged objects carry no latency.",
		), []string{"resource", "source"})),
		reconnects: registerOrReuse(reg, prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_informer_nats_reconnects_total",
			Help: "Times an informer's NATS subscription was (re)established after a gap. Live events published during the gap never reach this replica; the informer forces a re-list to recover them.",
		}, []string{"resource"})),
		liveSubscription: registerOrReuse(reg, prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "grafana_provisioning_informer_live_subscription",
			Help: "Whether the informer holds an open live NATS subscription (1) or runs re-list-only (0): before the subscription first opens, or in degraded-start mode. Mid-run connection outages are reported by grafana_nats_subscriber_connection_status instead — the subscription itself resumes transparently on reconnect.",
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

func (m *informerMetrics) observeLive(source, resourceName, verb string, rv int64) {
	m.liveEvents.WithLabelValues(resourceName, source, verb).Inc()
	m.observeLatency(m.liveLatency, source, resourceName, rv)
}

func (m *informerMetrics) observeRelist(source, resourceName, verb string, rv int64) {
	m.relistEvents.WithLabelValues(resourceName, source, verb).Inc()
	m.observeLatency(m.relistLatency, source, resourceName, rv)
}

func (m *informerMetrics) observeLatency(latency *prometheus.HistogramVec, source, resourceName string, rv int64) {
	if rv <= 0 {
		return
	}
	// The RV embeds the write's timestamp (snowflake or microsecond epoch);
	// negative results mean clock skew, not delivery, so they are dropped.
	seconds := time.Since(resource.ResourceVersionTime(rv)).Seconds()
	if seconds > 0 {
		latency.WithLabelValues(resourceName, source).Observe(seconds)
	}
}

// natsRecorder adapts informerMetrics to the NATS informer's metrics hook,
// labelling everything it observes with source=nats and one resource.
type natsRecorder struct {
	metrics      *informerMetrics
	resourceName string
}

var _ usinformer.Metrics = natsRecorder{}

func (r natsRecorder) ObserveLiveEvent(verb string, rv int64) {
	r.metrics.observeLive(sourceNATS, r.resourceName, verb, rv)
}

func (r natsRecorder) ObserveRelistEvent(verb string, rv int64) {
	r.metrics.observeRelist(sourceNATS, r.resourceName, verb, rv)
}

func (r natsRecorder) ObserveReconnect() {
	r.metrics.reconnects.WithLabelValues(r.resourceName).Inc()
}

func (r natsRecorder) ObserveLiveSubscription(open bool) {
	v := 0.0
	if open {
		v = 1
	}
	r.metrics.liveSubscription.WithLabelValues(r.resourceName).Set(v)
}

// apiServerMeter observes deliveries from an apiserver-backed
// SharedIndexInformer under source=apiserver, on the same series the NATS
// recorder writes. Register it as one extra event handler so each event is
// counted once however many controller handlers the informer has. The informer
// has no live/relist distinction of its own, so the meter derives it: initial-
// list adds and resync re-deliveries (same RV on both sides of an update) and
// re-list-detected deletes (DeletedFinalStateUnknown) count as relist,
// everything else came from the watch and counts as live.
type apiServerMeter struct {
	metrics      *informerMetrics
	resourceName string
}

var _ cache.ResourceEventHandler = apiServerMeter{}

func (h apiServerMeter) OnAdd(obj any, isInInitialList bool) {
	if isInInitialList {
		// Initial-list objects may be arbitrarily old: no latency sample.
		h.metrics.observeRelist(sourceAPIServer, h.resourceName, usinformer.VerbAdd, 0)
		return
	}
	h.metrics.observeLive(sourceAPIServer, h.resourceName, usinformer.VerbAdd, objectRV(obj))
}

func (h apiServerMeter) OnUpdate(oldObj, newObj any) {
	// A resync replays the store's object against itself; a live update always
	// carries a new RV.
	if objectRVString(oldObj) == objectRVString(newObj) {
		h.metrics.observeRelist(sourceAPIServer, h.resourceName, usinformer.VerbUpdate, 0)
		return
	}
	h.metrics.observeLive(sourceAPIServer, h.resourceName, usinformer.VerbUpdate, objectRV(newObj))
}

func (h apiServerMeter) OnDelete(obj any) {
	if _, missedDelete := obj.(cache.DeletedFinalStateUnknown); missedDelete {
		// The delete was detected by a re-list; the carried object's RV predates
		// the delete, so it cannot date it.
		h.metrics.observeRelist(sourceAPIServer, h.resourceName, usinformer.VerbDelete, 0)
		return
	}
	h.metrics.observeLive(sourceAPIServer, h.resourceName, usinformer.VerbDelete, objectRV(obj))
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

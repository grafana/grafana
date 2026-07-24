package informer

import (
	"context"
	"strconv"
	"sync"
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/client-go/tools/cache"

	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Metric source labels. Both delta-source mechanisms record to the same series,
// distinguished only by this label, so a dashboard can lay NATS delivery beside
// the apiserver watch it is replacing.
const (
	sourceNATS      = "nats"
	sourceAPIServer = "apiserver"
)

// Delivery labels. "live" is the low-latency path (a NATS notification or a watch
// event); "relist" is what the periodic re-list reconciled — under round-robin
// most events reach a given replica this way, so a single replica's live/relist
// split is not a loss signal, only the cluster-wide published-vs-consumed ratio is.
const (
	deliveryLive   = "live"
	deliveryRelist = "relist"
)

// Metrics records provisioning consumer-side event delivery, comparably across
// the NATS and apiserver-watch delta sources. It answers two questions: how long
// a consumer took to see an event (event_latency_seconds), and — combined with
// the publisher-side storage_server_watch_notifications_published_total
// denominator — whether events were missed (events_total{delivery="live"}).
type Metrics struct {
	events        *prometheus.CounterVec // source, resource, verb, delivery
	latency       *prometheus.HistogramVec
	reconnects    *prometheus.CounterVec // source, resource (nats only)
	watchErrors   *prometheus.CounterVec // source, resource (apiserver only)
	dropped       *prometheus.CounterVec // source, resource, reason
	relists       *prometheus.CounterVec // source, resource, trigger
	relistErrors  *prometheus.CounterVec // source, resource
	lastRelist    *prometheus.GaugeVec   // source, resource
	relistObjects *prometheus.GaugeVec   // source, resource
}

var (
	once    sync.Once
	metrics *Metrics
)

// RegisterMetrics registers the provisioning informer metrics once and returns
// the shared recorder. It is safe to call from every delta-source wiring site;
// the first call wins and later calls return the same instance, matching the
// other provisioning metric registrars.
func RegisterMetrics(reg prometheus.Registerer) *Metrics {
	once.Do(func() {
		metrics = newMetrics(reg)
	})
	return metrics
}

// newMetrics builds and registers the recorder against reg. RegisterMetrics
// wraps it in a sync.Once for the shared process-wide instance; tests call it
// directly with an isolated registry.
func newMetrics(reg prometheus.Registerer) *Metrics {
	m := &Metrics{
		events: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_informer_events_total",
			Help: "Change events delivered to provisioning controllers, by source (nats|apiserver), resource, verb (add|update|delete), and delivery (live|relist).",
		}, []string{"source", "resource", "verb", "delivery"}),
		latency: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "grafana_provisioning_informer_event_latency_seconds",
			Help:                            "Time between a resource version being issued and a provisioning controller receiving the event, by source and resource.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"source", "resource", "delivery"}),
		reconnects: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_informer_reconnects_total",
			Help: "NATS reconnects observed by a provisioning informer; each is a window in which live events may have been missed and are recovered on the next re-list.",
		}, []string{"source", "resource"}),
		watchErrors: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_informer_watch_errors_total",
			Help: "Apiserver watch errors observed by a provisioning informer (e.g. watch restarts / 410 Gone), the apiserver analog of a lossy window.",
		}, []string{"source", "resource"}),
		dropped: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_informer_dropped_events_total",
			Help: "NATS notifications an informer received but could not dispatch, by reason (unmarshal_error, unknown_type). A dropped event is invisible until the next re-list.",
		}, []string{"source", "resource", "reason"}),
		relists: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_informer_relists_total",
			Help: "Successful informer re-lists, by trigger (initial, resync, reconnect, periodic).",
		}, []string{"source", "resource", "trigger"}),
		relistErrors: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_informer_relist_errors_total",
			Help: "Failed informer re-lists (the API LIST errored); while failing, missed live events are not healed.",
		}, []string{"source", "resource"}),
		lastRelist: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "grafana_provisioning_informer_last_relist_success_timestamp_seconds",
			Help: "Unix timestamp of the last successful re-list; time since this is a hard upper bound on event staleness.",
		}, []string{"source", "resource"}),
		relistObjects: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "grafana_provisioning_informer_relist_objects",
			Help: "Number of objects returned by the most recent successful re-list, by source and resource.",
		}, []string{"source", "resource"}),
	}
	reg.MustRegister(m.events, m.latency, m.reconnects, m.watchErrors, m.dropped, m.relists, m.relistErrors, m.lastRelist, m.relistObjects)
	return m
}

// recordEvent increments the event counter and, when observeLatency is set and
// the resource version carries a usable timestamp, observes delivery latency.
// Latency is skipped for re-delivery that is not a real change (initial list,
// apiserver resync) so the histogram reflects genuine delivery delay.
func (m *Metrics) recordEvent(source, res, verb, delivery string, rv int64, observeLatency bool) {
	if m == nil {
		return
	}
	m.events.WithLabelValues(source, res, verb, delivery).Inc()
	if !observeLatency || rv <= 0 {
		return
	}
	if latency := time.Since(resource.ResourceVersionTime(rv)).Seconds(); latency > 0 {
		m.latency.WithLabelValues(source, res, delivery).Observe(latency)
	}
}

// NATSRecorder adapts Metrics to the generic informer's usinformer.Metrics hook,
// baking in the "nats" source label.
func (m *Metrics) NATSRecorder() usinformer.Metrics {
	return natsRecorder{m: m}
}

type natsRecorder struct{ m *Metrics }

var _ usinformer.Metrics = natsRecorder{}

func (r natsRecorder) ObserveLiveEvent(res, verb string, rv int64) {
	r.m.recordEvent(sourceNATS, res, verb, deliveryLive, rv, true)
}

func (r natsRecorder) ObserveRelistEvent(res, verb string, rv int64, initial bool) {
	// The initial list reports pre-existing objects, whose "latency" is their age,
	// not a delivery delay — count them but do not observe latency.
	r.m.recordEvent(sourceNATS, res, verb, deliveryRelist, rv, !initial)
}

func (r natsRecorder) ObserveReconnect(res string) {
	if r.m == nil {
		return
	}
	r.m.reconnects.WithLabelValues(sourceNATS, res).Inc()
}

func (r natsRecorder) ObserveDrop(res, reason string) {
	if r.m == nil {
		return
	}
	r.m.dropped.WithLabelValues(sourceNATS, res, reason).Inc()
}

func (r natsRecorder) ObserveRelist(res, trigger string, count int) {
	if r.m == nil {
		return
	}
	r.m.relists.WithLabelValues(sourceNATS, res, trigger).Inc()
	r.m.lastRelist.WithLabelValues(sourceNATS, res).SetToCurrentTime()
	r.m.relistObjects.WithLabelValues(sourceNATS, res).Set(float64(count))
}

func (r natsRecorder) ObserveRelistError(res string) {
	if r.m == nil {
		return
	}
	r.m.relistErrors.WithLabelValues(sourceNATS, res).Inc()
}

// MeterAPIServer wraps an apiserver-backed SharedIndexInformer so its delivered
// events and watch errors are recorded under the "apiserver" source, comparable
// to the NATS informer on the same series. A nil recorder returns the informer
// unchanged (it already satisfies DeltaSource).
func (m *Metrics) MeterAPIServer(res string, inf cache.SharedIndexInformer) DeltaSource {
	if m == nil {
		return inf
	}
	return meteredDeltaSource{m: m, res: res, inf: inf}
}

type meteredDeltaSource struct {
	m   *Metrics
	res string
	inf cache.SharedIndexInformer
}

var _ DeltaSource = meteredDeltaSource{}

func (s meteredDeltaSource) AddEventHandler(h cache.ResourceEventHandler) (cache.ResourceEventHandlerRegistration, error) {
	return s.inf.AddEventHandler(s.m.wrapAPIServerHandler(s.res, h))
}

func (s meteredDeltaSource) Run(stopCh <-chan struct{}) {
	// Must be set before Run; the informer has not started yet at this point.
	_ = s.inf.SetWatchErrorHandlerWithContext(s.m.watchErrorHandler(s.res))
	s.inf.Run(stopCh)
}

// wrapAPIServerHandler decorates a controller's event handler so an
// apiserver-backed SharedIndexInformer records the same delivery metrics as the
// NATS informer, under the "apiserver" source label.
func (m *Metrics) wrapAPIServerHandler(res string, inner cache.ResourceEventHandler) cache.ResourceEventHandler {
	return apiServerHandler{m: m, res: res, inner: inner}
}

// watchErrorHandler counts apiserver watch errors while preserving the default
// logging behaviour.
func (m *Metrics) watchErrorHandler(res string) cache.WatchErrorHandlerWithContext {
	return func(ctx context.Context, r *cache.Reflector, err error) {
		if m != nil {
			m.watchErrors.WithLabelValues(sourceAPIServer, res).Inc()
		}
		cache.DefaultWatchErrorHandler(ctx, r, err)
	}
}

type apiServerHandler struct {
	m     *Metrics
	res   string
	inner cache.ResourceEventHandler
}

var _ cache.ResourceEventHandler = apiServerHandler{}

func (h apiServerHandler) OnAdd(obj any, isInInitialList bool) {
	if isInInitialList {
		// Initial-list adds mirror the NATS initial re-list: counted as relist, no latency.
		h.m.recordEvent(sourceAPIServer, h.res, "add", deliveryRelist, anyRV(obj), false)
	} else {
		h.m.recordEvent(sourceAPIServer, h.res, "add", deliveryLive, anyRV(obj), true)
	}
	h.inner.OnAdd(obj, isInInitialList)
}

func (h apiServerHandler) OnUpdate(oldObj, newObj any) {
	// A periodic resync re-delivers with an unchanged resource version; only a real
	// change (the version advanced) is a live event with meaningful latency. Skipping
	// resync keeps the live count symmetric with the NATS informer, which does not
	// count unchanged re-list updates.
	if oldRV, newRV := anyRV(oldObj), anyRV(newObj); newRV > oldRV {
		h.m.recordEvent(sourceAPIServer, h.res, "update", deliveryLive, newRV, true)
	}
	h.inner.OnUpdate(oldObj, newObj)
}

func (h apiServerHandler) OnDelete(obj any) {
	h.m.recordEvent(sourceAPIServer, h.res, "delete", deliveryLive, anyRV(obj), true)
	h.inner.OnDelete(obj)
}

// anyRV reads the resource version off an object delivered by a SharedIndexInformer,
// unwrapping the tombstone a delete may carry, returning 0 when it is unavailable.
func anyRV(obj any) int64 {
	if tombstone, ok := obj.(cache.DeletedFinalStateUnknown); ok {
		obj = tombstone.Obj
	}
	m, err := meta.Accessor(obj)
	if err != nil {
		return 0
	}
	rv, err := strconv.ParseInt(m.GetResourceVersion(), 10, 64)
	if err != nil {
		return 0
	}
	return rv
}

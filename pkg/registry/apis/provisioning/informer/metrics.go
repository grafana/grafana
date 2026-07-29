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
// watch compare directly: how many events arrived (by delivery: live vs the
// periodic re-list/resync) and how long after the change was written. Events a
// replica missed live cannot be counted here — under the round-robin queue
// group each notification reaches one replica, so a per-replica gap measures
// routing, not loss. Missed NATS events are the cluster-wide difference between
// the publisher's storage_server_watch_notifications_published_total and
// events_total{source="nats",delivery="live"} summed across replicas.
type informerMetrics struct {
	events     *prometheus.CounterVec
	latency    *prometheus.HistogramVec
	reconnects *prometheus.CounterVec
}

// newInformerMetrics builds the delivery metrics on reg, reusing collectors
// already registered there so every delta source in the process shares one set.
// A nil reg leaves the collectors unregistered.
func newInformerMetrics(reg prometheus.Registerer) *informerMetrics {
	return &informerMetrics{
		events: registerOrReuse(reg, prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_informer_events_total",
			Help: "Events delivered to provisioning informer handlers, by resource, source (nats, apiserver), delivery (live, relist) and verb. Relist adds and deletes are changes recovered by the periodic re-list; relist updates are its re-deliveries of unchanged objects.",
		}, []string{"resource", "source", "delivery", "verb"})),
		latency: registerOrReuse(reg, prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "grafana_provisioning_informer_event_latency_seconds",
			Help:                            "Time from a change's resource version being issued to its event reaching the informer handlers. Recorded for live events and for relist-recovered adds (where it is the recovery delay); re-deliveries of unchanged objects carry no latency.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"resource", "source", "delivery"})),
		reconnects: registerOrReuse(reg, prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_informer_nats_reconnects_total",
			Help: "Times an informer's NATS subscription was (re)established after a gap. Live events published during the gap never reach this replica; the informer forces a re-list to recover them.",
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

func (m *informerMetrics) observe(source, resourceName, delivery, verb string, rv int64) {
	m.events.WithLabelValues(resourceName, source, delivery, verb).Inc()
	if rv <= 0 {
		return
	}
	// The RV embeds the write's timestamp (snowflake or microsecond epoch);
	// negative results mean clock skew, not delivery, so they are dropped.
	latency := time.Since(resource.ResourceVersionTime(rv)).Seconds()
	if latency > 0 {
		m.latency.WithLabelValues(resourceName, source, delivery).Observe(latency)
	}
}

// natsRecorder adapts informerMetrics to the NATS informer's metrics hook,
// labelling everything it observes with source=nats and one resource.
type natsRecorder struct {
	metrics      *informerMetrics
	resourceName string
}

var _ usinformer.Metrics = natsRecorder{}

func (r natsRecorder) ObserveEvent(delivery, verb string, rv int64) {
	r.metrics.observe(sourceNATS, r.resourceName, delivery, verb, rv)
}

func (r natsRecorder) ObserveReconnect() {
	r.metrics.reconnects.WithLabelValues(r.resourceName).Inc()
}

// apiServerMeter observes deliveries from an apiserver-backed
// SharedIndexInformer under source=apiserver, on the same series the NATS
// recorder writes. Register it as one extra event handler so each event is
// counted once however many controller handlers the informer has. The informer
// has no live/relist distinction of its own, so the meter derives it: initial-
// list adds and resync re-deliveries (same RV on both sides of an update) and
// re-list-detected deletes (DeletedFinalStateUnknown) are delivery=relist,
// everything else came from the watch and is delivery=live.
type apiServerMeter struct {
	metrics      *informerMetrics
	resourceName string
}

var _ cache.ResourceEventHandler = apiServerMeter{}

func (h apiServerMeter) OnAdd(obj any, isInInitialList bool) {
	if isInInitialList {
		// Initial-list objects may be arbitrarily old: no latency sample.
		h.metrics.observe(sourceAPIServer, h.resourceName, usinformer.DeliveryRelist, usinformer.VerbAdd, 0)
		return
	}
	h.metrics.observe(sourceAPIServer, h.resourceName, usinformer.DeliveryLive, usinformer.VerbAdd, objectRV(obj))
}

func (h apiServerMeter) OnUpdate(oldObj, newObj any) {
	// A resync replays the store's object against itself; a live update always
	// carries a new RV.
	if objectRVString(oldObj) == objectRVString(newObj) {
		h.metrics.observe(sourceAPIServer, h.resourceName, usinformer.DeliveryRelist, usinformer.VerbUpdate, 0)
		return
	}
	h.metrics.observe(sourceAPIServer, h.resourceName, usinformer.DeliveryLive, usinformer.VerbUpdate, objectRV(newObj))
}

func (h apiServerMeter) OnDelete(obj any) {
	if _, missedDelete := obj.(cache.DeletedFinalStateUnknown); missedDelete {
		// The delete was detected by a re-list; the carried object's RV predates
		// the delete, so it cannot date it.
		h.metrics.observe(sourceAPIServer, h.resourceName, usinformer.DeliveryRelist, usinformer.VerbDelete, 0)
		return
	}
	h.metrics.observe(sourceAPIServer, h.resourceName, usinformer.DeliveryLive, usinformer.VerbDelete, objectRV(obj))
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

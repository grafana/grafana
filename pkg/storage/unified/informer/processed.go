package informer

import (
	"errors"
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
)

// ProcessTrigger records how the work-queue key a consumer is now processing was
// enqueued: by a live event, by the periodic re-list, or by the informer's
// initial list. It is the value of the "source" metric label.
type ProcessTrigger string

const (
	// TriggerLive: enqueued by a live event (a NATS notification or an apiserver
	// watch add).
	TriggerLive ProcessTrigger = "live"
	// TriggerRelist: enqueued only by the periodic re-list/resync.
	TriggerRelist ProcessTrigger = "relist"
	// TriggerInitial: from the informer's initial list (the startup backlog),
	// kept separate so restarts do not pollute the relist signal.
	TriggerInitial ProcessTrigger = "initial"
)

// ProcessedMetrics is the consumer-side instrumentation for a unified-storage
// informer feed. A consumer classifies each delivery at enqueue (ClassifyAdd /
// ClassifyUpdate) and, when it commits to genuinely processing a key (not a
// duplicate, not ignored), records it (RecordProcessed) and how late the event
// reached the queue (ObserveDeliveryLatency). Delivery shape and backend are
// encapsulated here: the recorder holds natsBacked and does the classification,
// so consumers pass only raw event facts.
//
// It emits, discriminated by a "source" label (live/relist/initial):
//   - grafana_provisioning_events_processed_total{resource, source}
//   - grafana_provisioning_event_delivery_latency_seconds{resource, source}
//
// The resource name is a constructor parameter, so one family serves every
// consumer, distinguished by the resource label.
//
// The exactness of the "missed live event" reading depends on the consumer. A
// consumer with a cluster-wide exactly-once gate (e.g. the jobs claim, which
// drops re-list redeliveries of already-processed keys) makes source="relist"
// the cluster-wide missed/late-live-event signal. A consumer that reconciles
// every delivery has no such gate, so its source="relist" measures
// resync-driven work volume rather than missed events.
type ProcessedMetrics struct {
	resource        string
	natsBacked      bool
	processed       *prometheus.CounterVec
	deliveryLatency *prometheus.HistogramVec
}

// NewProcessedMetrics builds the metrics on reg for the given resource label
// value and delivery backend, reusing collectors already registered on reg so
// several consumers share one set of series. A nil reg leaves the collectors
// unregistered (the recorder still classifies and its record calls are harmless
// no-ops).
func NewProcessedMetrics(reg prometheus.Registerer, resource string, natsBacked bool) *ProcessedMetrics {
	return &ProcessedMetrics{
		resource:   resource,
		natsBacked: natsBacked,
		processed: registerOrReuse(reg, prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_events_processed_total",
			Help: "Processing started for a work-queue key, by resource and source (live = a live event; relist = the periodic re-list; initial = the informer's initial list).",
		}, []string{"resource", "source"})),
		deliveryLatency: registerOrReuse(reg, prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "grafana_provisioning_event_delivery_latency_seconds",
			Help:                            "Time from an event being issued (its resource version, in the DB/NATS) to it entering the work queue, by resource and source, sampled only for events that lead to genuine processing. Excludes the time the key then waits in the queue to be picked up.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"resource", "source"})),
	}
}

// ClassifyAdd attributes an informer add delivery. NATS live events are minimal
// objects (no resource version); list-delivered objects are full. A full-RV
// non-initial add is a re-list recovery under NATS but a live watch add under
// the apiserver, disambiguated by the recorder's backend.
func (m *ProcessedMetrics) ClassifyAdd(resourceVersion string, isInInitialList bool) ProcessTrigger {
	switch {
	case resourceVersion == "":
		return TriggerLive // NATS minimal live event
	case isInInitialList:
		return TriggerInitial
	case m.natsBacked:
		return TriggerRelist // re-list recovered a key never delivered live here
	default:
		return TriggerLive // apiserver live watch add
	}
}

// ClassifyUpdate attributes an informer update delivery. A re-list/resync
// re-delivers a retained object unchanged (equal, non-empty resource versions),
// which is relist; any other update is a live modification, classified like an
// add with the modified object's resource version.
func (m *ProcessedMetrics) ClassifyUpdate(oldResourceVersion, newResourceVersion string) ProcessTrigger {
	if newResourceVersion != "" && oldResourceVersion == newResourceVersion {
		return TriggerRelist
	}
	return m.ClassifyAdd(newResourceVersion, false)
}

// RecordProcessed increments the processed counter for the given source. It is
// nil-safe, and ignores an unknown source (e.g. the zero value carried by a
// queue item that was never classified).
func (m *ProcessedMetrics) RecordProcessed(trigger ProcessTrigger) {
	if m == nil {
		return
	}
	switch trigger {
	case TriggerLive, TriggerRelist, TriggerInitial:
		m.processed.WithLabelValues(m.resource, string(trigger)).Inc()
	}
}

// ObserveDeliveryLatency records, under the given source, the delay from an
// event's generation to it entering the work queue, for an event that led to
// genuine processing. It is nil-safe and ignores an unknown source or a negative
// sample (clock skew, or a generation time that is unknown/zero).
func (m *ProcessedMetrics) ObserveDeliveryLatency(trigger ProcessTrigger, seconds float64) {
	if m == nil || seconds < 0 {
		return
	}
	switch trigger {
	case TriggerLive, TriggerRelist, TriggerInitial:
		m.deliveryLatency.WithLabelValues(m.resource, string(trigger)).Observe(seconds)
	}
}

// registerOrReuse registers c on reg, returning the collector already registered
// under the same descriptor when there is one — several consumers built against
// the same registry share one set of collectors. A nil reg returns c
// unregistered.
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

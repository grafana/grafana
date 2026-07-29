package informer

import (
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
)

// ProcessTrigger records what enqueued the work-queue key that a consumer
// (the jobs driver, the repository or connection controller) is now processing.
type ProcessTrigger string

const (
	// TriggerLive: the key was enqueued by a live event (a NATS notification or
	// an apiserver watch add).
	TriggerLive ProcessTrigger = "live"
	// TriggerRelist: the key was enqueued only by the periodic re-list/resync.
	TriggerRelist ProcessTrigger = "relist"
	// TriggerInitial: the key came from the informer's initial list (the startup
	// backlog), kept separate so restarts do not pollute the relist signal.
	TriggerInitial ProcessTrigger = "initial"
)

// ProcessedMetrics records, per resource and source, the start of processing for
// a work-queue key attributed to what enqueued it, plus how late the event
// reached the queue. The source label (live/relist/initial) discriminates the
// single processed counter and the single latency histogram. It is the
// consumer-side pair of the informer delivery metrics: comparing
// rate(events_processed_total{source="relist"}) with
// rate(informer_relist_events) shows how much work arrives via re-list instead
// of live.
//
// The exactness of the "missed live event" reading depends on the consumer. The
// jobs driver processes each job exactly once cluster-wide (the claim gate drops
// re-list redeliveries of already-processed jobs), so its source="relist" count
// is the cluster-wide missed/late-live-event signal. The repository and
// connection controllers have no such gate: a re-list re-delivers every key to
// every replica and each reconciles it, so their source="relist" count measures
// resync-driven reconcile volume rather than missed events.
type ProcessedMetrics struct {
	resource        string
	processed       *prometheus.CounterVec
	deliveryLatency *prometheus.HistogramVec
}

// NewProcessedMetrics builds the processing metrics on reg for the given resource
// label value, reusing collectors already registered there so several consumers
// on one registry share the same series. A nil reg leaves the collectors
// unregistered.
func NewProcessedMetrics(reg prometheus.Registerer, resource string) *ProcessedMetrics {
	return &ProcessedMetrics{
		resource: resource,
		processed: registerOrReuse(reg, prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_events_processed_total",
			Help: "Processing started for a work-queue key, by resource and source (live = a live event; relist = the periodic re-list; initial = the informer's initial list). For the jobs driver source=\"relist\" is the cluster-wide missed/late-live-event signal; for the repository and connection controllers it is resync-driven reconcile volume.",
		}, []string{"resource", "source"})),
		deliveryLatency: registerOrReuse(reg, prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "grafana_provisioning_event_delivery_latency_seconds",
			Help:                            "Time from an event being issued (its resource version, in the DB/NATS) to it entering the work queue, by resource and source, sampled only for events that lead to genuine processing (not duplicates or ignored). Excludes the time the key then waits in the queue to be picked up.",
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
// the apiserver, disambiguated by natsBacked.
func ClassifyAdd(resourceVersion string, isInInitialList, natsBacked bool) ProcessTrigger {
	switch {
	case resourceVersion == "":
		return TriggerLive // NATS minimal live event
	case isInInitialList:
		return TriggerInitial
	case natsBacked:
		return TriggerRelist // re-list recovered a key never delivered live here
	default:
		return TriggerLive // apiserver live watch add
	}
}

// ClassifyUpdate attributes an informer update delivery. A re-list/resync
// re-delivers a retained object unchanged (equal, non-empty resource versions),
// which is relist; any other update is a live modification, classified like an
// add with the modified object's resource version.
func ClassifyUpdate(oldResourceVersion, newResourceVersion string, natsBacked bool) ProcessTrigger {
	if newResourceVersion != "" && oldResourceVersion == newResourceVersion {
		return TriggerRelist
	}
	return ClassifyAdd(newResourceVersion, false, natsBacked)
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

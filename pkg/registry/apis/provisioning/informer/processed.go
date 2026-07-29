package informer

import "github.com/prometheus/client_golang/prometheus"

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

// ProcessedMetrics counts, per resource, the start of processing for a
// work-queue key attributed to what enqueued it. It is the consumer-side pair of
// the informer delivery metrics: comparing rate(relist_events_processed) with
// rate(informer_relist_events) shows how much work arrives via re-list instead
// of live.
//
// The exactness of the "missed live event" reading depends on the consumer. The
// jobs driver processes each job exactly once cluster-wide (the claim gate drops
// re-list redeliveries of already-processed jobs), so its relist counter is the
// cluster-wide missed/late-live-event signal. The repository and connection
// controllers have no such gate: a re-list re-delivers every key to every
// replica and each reconciles it, so their relist counter measures
// resync-driven reconcile volume rather than missed events.
type ProcessedMetrics struct {
	resource string
	live     *prometheus.CounterVec
	relist   *prometheus.CounterVec
	initial  *prometheus.CounterVec
}

// NewProcessedMetrics builds the processing counters on reg for the given
// resource label value, reusing collectors already registered there so several
// consumers on one registry share the same series. A nil reg leaves the
// collectors unregistered.
func NewProcessedMetrics(reg prometheus.Registerer, resource string) *ProcessedMetrics {
	return &ProcessedMetrics{
		resource: resource,
		live: registerOrReuse(reg, prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_live_events_processed_total",
			Help: "Processing started for a work-queue key enqueued by a live event, by resource.",
		}, []string{"resource"})),
		relist: registerOrReuse(reg, prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_relist_events_processed_total",
			Help: "Processing started for a work-queue key enqueued only by the periodic re-list, by resource. For the jobs driver this is the cluster-wide missed/late-live-event signal; for the repository and connection controllers it is resync-driven reconcile volume.",
		}, []string{"resource"})),
		initial: registerOrReuse(reg, prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_initial_events_processed_total",
			Help: "Processing started for a work-queue key from the informer's initial list (the startup backlog), by resource.",
		}, []string{"resource"})),
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

// RecordProcessed increments the counter matching trigger. It is nil-safe: a
// consumer built without metrics passes a nil *ProcessedMetrics.
func (m *ProcessedMetrics) RecordProcessed(trigger ProcessTrigger) {
	if m == nil {
		return
	}
	switch trigger {
	case TriggerLive:
		m.live.WithLabelValues(m.resource).Inc()
	case TriggerRelist:
		m.relist.WithLabelValues(m.resource).Inc()
	case TriggerInitial:
		m.initial.WithLabelValues(m.resource).Inc()
	}
}

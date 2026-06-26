package server

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const (
	metricsNamespace = "iam"
	metricsSubSystem = "authz_zanzana_server"
)

type metrics struct {
	// requestDurationSeconds is a summary for zanzana server request duration
	requestDurationSeconds *prometheus.HistogramVec
	// batchCheckPhaseDurationSeconds measures the duration of each batch check phase
	batchCheckPhaseDurationSeconds *prometheus.HistogramVec
	// inflightRequests tracks current in-flight requests by method
	inflightRequests *prometheus.GaugeVec
	// rejectedRequests counts requests rejected by the concurrency limiter
	rejectedRequests *prometheus.CounterVec

	// Pre-resolved children for hot-path label values. WithLabelValues hashes the
	// labels and takes the vec's internal lock on every call; resolving the known
	// method/phase children once at construction turns each per-request observation
	// into a plain map read (safe for concurrent reads; the maps are never written
	// after construction).
	requestDuration map[string]prometheus.Observer
	inflight        map[string]prometheus.Gauge
	batchPhase      map[string]prometheus.Observer
}

// requestMethods are the method label values resolved up front. Anything not
// listed here falls back to WithLabelValues (cold paths only).
var requestMethods = []string{
	"Check", "BatchCheck", "List",
	"Mutate", "WriteTuples", "Read", "ReadTuples", "Query", "Write",
}

// batchPhases are the batch-check phase label values resolved up front.
var batchPhases = []string{
	"group_resource", "folder_permission", "folder_subresource", "direct_resource",
}

func newZanzanaServerMetrics(reg prometheus.Registerer) *metrics {
	requestDurationSeconds := promauto.With(reg).NewHistogramVec(
		prometheus.HistogramOpts{
			Name:      "request_duration_seconds",
			Help:      "Histogram for zanzana server request duration",
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Buckets:   prometheus.ExponentialBuckets(0.00001, 4, 10),
		},
		[]string{"method"},
	)
	batchCheckPhaseDurationSeconds := promauto.With(reg).NewHistogramVec(
		prometheus.HistogramOpts{
			Name:      "batch_check_phase_duration_seconds",
			Help:      "Histogram for batch check phase duration",
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Buckets:   prometheus.ExponentialBuckets(0.00001, 4, 10),
		},
		[]string{"phase"},
	)
	inflightRequests := promauto.With(reg).NewGaugeVec(
		prometheus.GaugeOpts{
			Name:      "inflight_requests",
			Help:      "Current number of in-flight requests",
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
		},
		[]string{"method"},
	)

	m := &metrics{
		requestDurationSeconds:         requestDurationSeconds,
		batchCheckPhaseDurationSeconds: batchCheckPhaseDurationSeconds,
		inflightRequests:               inflightRequests,
		rejectedRequests: promauto.With(reg).NewCounterVec(
			prometheus.CounterOpts{
				Name:      "rejected_requests_total",
				Help:      "Total requests rejected by the concurrency limiter",
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
			},
			[]string{"method", "limiter"},
		),
		requestDuration: make(map[string]prometheus.Observer, len(requestMethods)),
		inflight:        make(map[string]prometheus.Gauge, len(requestMethods)),
		batchPhase:      make(map[string]prometheus.Observer, len(batchPhases)),
	}

	for _, method := range requestMethods {
		m.requestDuration[method] = requestDurationSeconds.WithLabelValues(method)
		m.inflight[method] = inflightRequests.WithLabelValues(method)
	}
	for _, phase := range batchPhases {
		m.batchPhase[phase] = batchCheckPhaseDurationSeconds.WithLabelValues(phase)
	}

	return m
}

// observeRequestDuration records request duration, using a pre-resolved observer
// for known methods and falling back to a label lookup for cold paths.
func (m *metrics) observeRequestDuration(method string, seconds float64) {
	if o, ok := m.requestDuration[method]; ok {
		o.Observe(seconds)
		return
	}
	m.requestDurationSeconds.WithLabelValues(method).Observe(seconds)
}

// observeBatchPhase records a batch-check phase duration via a pre-resolved observer.
func (m *metrics) observeBatchPhase(phase string, seconds float64) {
	if o, ok := m.batchPhase[phase]; ok {
		o.Observe(seconds)
		return
	}
	m.batchCheckPhaseDurationSeconds.WithLabelValues(phase).Observe(seconds)
}

// incInflight / decInflight adjust the in-flight gauge via a pre-resolved child.
func (m *metrics) incInflight(method string) {
	if g, ok := m.inflight[method]; ok {
		g.Inc()
		return
	}
	m.inflightRequests.WithLabelValues(method).Inc()
}

func (m *metrics) decInflight(method string) {
	if g, ok := m.inflight[method]; ok {
		g.Dec()
		return
	}
	m.inflightRequests.WithLabelValues(method).Dec()
}

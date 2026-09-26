package router

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/sony/gobreaker/v2"
)

// unknownGroupLabel replaces groups the router does not serve, so arbitrary
// client paths cannot create new series.
const unknownGroupLabel = "unknown"

// routerMetrics is the router's request and event instrumentation. Like the
// Kubernetes apiserver, it keeps long-running requests (watches) out of the
// duration histogram and the in-flight gauge, so one watch lasting half an
// hour doesn't distort latency or look like load. Route state, such as the
// groups served and breaker states, is read at scrape time by routerCollector.
type routerMetrics struct {
	inFlight           prometheus.Gauge
	longRunning        *prometheus.GaugeVec
	duration           *prometheus.HistogramVec
	backendFailures    *prometheus.CounterVec
	breakerTransitions *prometheus.CounterVec
	discoveryResults   *prometheus.CounterVec
}

func newRouterMetrics(reg prometheus.Registerer) *routerMetrics {
	m := &routerMetrics{
		inFlight: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace: "grafana",
			Subsystem: "router",
			Name:      "http_requests_in_flight",
			Help:      "Number of requests, other than watches, currently being served by the router.",
		}),
		longRunning: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: "grafana",
			Subsystem: "router",
			Name:      "longrunning_requests",
			Help:      "Number of watches currently being served by the router.",
		}, []string{"group"}),
		duration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       "grafana",
			Subsystem:                       "router",
			Name:                            "http_request_duration_seconds",
			Help:                            "Latency of requests, other than watches, served by the router, by group, verb, route (backend, fallback, discovery, next or invalid) and status code.",
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"group", "verb", "route", "status_code"}),
		backendFailures: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "router",
			Name:      "backend_failures_total",
			Help:      "Requests whose backend could not be reached or answered, by group and reason: breaker_open, timeout, transport, redirect_rejected or stack_origin_mismatch.",
		}, []string{"group", "reason"}),
		breakerTransitions: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "router",
			Name:      "breaker_transitions_total",
			Help:      "Circuit breaker state changes, by group and the state entered: closed, half-open or open.",
		}, []string{"group", "state"}),
		discoveryResults: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "router",
			Name:      "discovery_results_total",
			Help:      "How each group's aggregated discovery was obtained: provided, cached, fetched, stale or unavailable.",
		}, []string{"group", "result"}),
	}
	reg.MustRegister(m.inFlight, m.longRunning, m.duration, m.backendFailures, m.breakerTransitions, m.discoveryResults)
	return m
}

func (m *routerMetrics) breakerChanged(group string, to gobreaker.State) {
	m.breakerTransitions.WithLabelValues(group, to.String()).Inc()
}

func (m *routerMetrics) discoveryResult(group, result string) {
	m.discoveryResults.WithLabelValues(group, result).Inc()
}

// instrument serves req through gr.HandleFunc with request metrics, then logs
// the outcome. next is forwarded to HandleFunc unchanged.
func (m *routerMetrics) instrument(gr *GrafanaRouter, w http.ResponseWriter, req *http.Request, next http.Handler) {
	group := GroupFromPath(req.URL.Path)
	metricGroup := group
	if group != "" && !gr.KnownGroup(group) {
		metricGroup = unknownGroupLabel
	}
	verb := requestVerb(req)
	start := time.Now()
	rec := newStatusRecorder(w)
	req, outcome := withRequestOutcome(req)
	recordFailure := func() {
		if outcome.failure != "" {
			m.backendFailures.WithLabelValues(metricGroup, outcome.failure).Inc()
		}
	}

	if verb == "watch" {
		m.longRunning.WithLabelValues(metricGroup).Inc()
		defer m.longRunning.WithLabelValues(metricGroup).Dec()
		defer func() {
			recordFailure()
			logRequest(req, group, rec.status, time.Since(start))
		}()
		gr.HandleFunc(rec.writer(), req, next)
		return
	}

	m.inFlight.Inc()
	defer m.inFlight.Dec()
	gr.HandleFunc(rec.writer(), req, next)
	duration := time.Since(start)
	route := outcome.route
	if route == "" {
		route = routeNext
	}
	m.duration.
		WithLabelValues(metricGroup, verb, route, strconv.Itoa(rec.status)).
		Observe(duration.Seconds())
	recordFailure()
	logRequest(req, group, rec.status, duration)
}

package router

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// unknownGroupLabel replaces groups the router does not serve, so arbitrary
// client paths cannot create new series.
const unknownGroupLabel = "unknown"

// routerMetrics is the router's request instrumentation: a duration histogram
// by group, verb and status code, an in-flight gauge, and a gauge of watches.
// Like the Kubernetes apiserver, it keeps long-running requests (watches) out
// of the histogram and the in-flight gauge, so one watch lasting half an hour
// doesn't distort latency or look like load.
type routerMetrics struct {
	inFlight    prometheus.Gauge
	longRunning *prometheus.GaugeVec
	duration    *prometheus.HistogramVec
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
			Help:                            "Native histogram of latencies for requests, other than watches, served by the router.",
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"group", "verb", "status_code"}),
	}
	reg.MustRegister(m.inFlight, m.longRunning, m.duration)
	return m
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

	if verb == "watch" {
		m.longRunning.WithLabelValues(metricGroup).Inc()
		defer m.longRunning.WithLabelValues(metricGroup).Dec()
		defer func() { logRequest(req, group, rec.status, time.Since(start)) }()
		gr.HandleFunc(rec.writer(), req, next)
		return
	}

	m.inFlight.Inc()
	defer m.inFlight.Dec()
	gr.HandleFunc(rec.writer(), req, next)
	duration := time.Since(start)
	m.duration.
		WithLabelValues(metricGroup, verb, strconv.Itoa(rec.status)).
		Observe(duration.Seconds())
	logRequest(req, group, rec.status, duration)
}

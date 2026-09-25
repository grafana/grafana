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
// by group and status code, plus an in-flight gauge.
type routerMetrics struct {
	inFlight prometheus.Gauge
	duration *prometheus.HistogramVec
}

func newRouterMetrics(reg prometheus.Registerer) *routerMetrics {
	m := &routerMetrics{
		inFlight: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace: "grafana",
			Subsystem: "router",
			Name:      "http_requests_in_flight",
			Help:      "Number of requests currently being served by the cloud-apps router.",
		}),
		duration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       "grafana",
			Subsystem:                       "router",
			Name:                            "http_request_duration_seconds",
			Help:                            "Native histogram of latencies for requests served by the cloud-apps router.",
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"group", "status_code"}),
	}
	reg.MustRegister(m.inFlight, m.duration)
	return m
}

// instrument serves req through gr.HandleFunc with request-duration and
// in-flight instrumentation, then logs the outcome. next is forwarded to
// HandleFunc unchanged -- same fall-through behavior as an uninstrumented
// call.
func (m *routerMetrics) instrument(gr *GrafanaRouter, w http.ResponseWriter, req *http.Request, next http.Handler) {
	m.inFlight.Inc()
	defer m.inFlight.Dec()

	start := time.Now()
	rec := newStatusRecorder(w)
	gr.HandleFunc(rec, req, next)
	duration := time.Since(start)

	group := GroupFromPath(req.URL.Path)
	metricGroup := group
	if group != "" && !gr.KnownGroup(group) {
		metricGroup = unknownGroupLabel
	}
	m.duration.
		WithLabelValues(metricGroup, strconv.Itoa(rec.status)).
		Observe(duration.Seconds())

	logRequest(req, group, rec.status, duration)
}

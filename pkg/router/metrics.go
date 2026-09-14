package router

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// unknownGroupLabel is substituted for the group label whenever the raw path
// segment (see GroupFromPath) doesn't match a backend the router actually
// serves. Without this, a client hitting /apis/<anything-it-likes> -- typos,
// scans, or a deliberate attack -- would mint a new label value, and for a
// native histogram a new series, per unique string.
const unknownGroupLabel = "unknown"

// routerMetrics is the router's request-serving instrumentation: a duration
// histogram labeled by /apis/<group> (see GroupFromPath -- the one thing that
// varies meaningfully request to request in a proxy that only serves /apis
// and /openapi/v3) and status code, plus an in-flight gauge. Registered on
// the caller's own registerer (the module server's shared one, or a test's),
// not a private registry -- unlike the old standalone `grafana router`
// process, this runs inside a process that already owns /metrics.
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

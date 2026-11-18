// Package proxymetrics records the outcome of requests proxied to a datasource,
// in the same shape for the legacy /api/datasources/proxy handler and the
// /apis/.../proxy subresource, so both can be compared and queried together.
package proxymetrics

import (
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
)

// Variant identifies which proxy implementation served the request.
const (
	// VariantLegacy is the /api/datasources/proxy handler.
	VariantLegacy = "legacy"
	// VariantST is the /apis proxy subresource in single-tenant Grafana.
	VariantST = "st"
	// VariantMT is the /apis proxy subresource in multi-tenant Grafana.
	VariantMT = "mt"
)

// Source says who produced the final response status.
const (
	// SourceServer is Grafana itself, including requests rejected before they reach the datasource.
	SourceServer = "server"
	// SourceDownstream is the datasource: a 5xx it returned, or a failure reaching it.
	SourceDownstream = "downstream"
	// SourceClient is a request the caller abandoned (499).
	SourceClient = "client"
)

const (
	unknownPlugin = "unknown"

	// sampleEvery logs one in this many requests that did not fail. Failures are
	// always logged.
	sampleEvery   = 1000
	maxLoggedPath = 200
)

// Metrics holds the proxy collectors. The zero value and nil are valid and record nothing.
//
// The counter deliberately has no path or per-datasource label: those are
// unbounded, and a multi-tenant process serves many stacks. That detail goes to
// the log, which Observe writes for failures and a sample of other requests.
type Metrics struct {
	requests *prometheus.CounterVec
	duration *prometheus.HistogramVec
	log      log.Logger
	seen     atomic.Uint64
}

// New registers the proxy collectors on reg with a constant variant label. Two
// components that proxy in one process, such as the legacy handler and the /apis
// subresource, share the metric names and differ only by variant.
func New(reg prometheus.Registerer, variant string) *Metrics {
	factory := promauto.With(reg)
	constLabels := prometheus.Labels{"variant": variant}

	return &Metrics{
		log: log.New("datasource.proxy").New("variant", variant),
		requests: factory.NewCounterVec(prometheus.CounterOpts{
			Name:        "grafana_datasource_proxy_requests_total",
			Help:        "Total requests proxied to a datasource, by plugin, status code and status source.",
			ConstLabels: constLabels,
		}, []string{"plugin_id", "status_code", "status_source"}),
		duration: factory.NewHistogramVec(prometheus.HistogramOpts{
			Name:        "grafana_datasource_proxy_request_duration_seconds",
			Help:        "Duration of requests proxied to a datasource, by plugin and status class.",
			Buckets:     []float64{.01, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 60, 120},
			ConstLabels: constLabels,
		}, []string{"plugin_id", "status_class"}),
	}
}

var (
	sharedMu sync.Mutex
	shared   = map[string]*Metrics{}
)

// ForVariant returns the process-wide collectors for a variant, registering them
// on first use. Callers cannot take a registerer from their constructors without
// changing the Wire graph that other builds generate against, and one process
// builds many proxies (one /apis builder per plugin) that must share collectors.
//
// They go on the registry the legacy proxy is wired with, because the gatherer
// rejects a metric name that appears in two registries.
func ForVariant(variant string) *Metrics {
	sharedMu.Lock()
	defer sharedMu.Unlock()
	m, ok := shared[variant]
	if !ok {
		m = New(metrics.ProvideRegisterer(), variant)
		shared[variant] = m
	}
	return m
}

// Observation is one finished proxy request.
type Observation struct {
	PluginID string
	Status   int
	Source   string
	Duration time.Duration

	// The fields below are only logged, never used as metric labels.
	Method string
	// Path is the path forwarded to the datasource, without the proxy prefix.
	Path          string
	DatasourceUID string
	// Namespace identifies the tenant on the /apis path.
	Namespace string
}

// Observe records one finished request, and logs it if it failed or was sampled.
func (m *Metrics) Observe(o Observation) {
	if m == nil {
		return
	}
	pluginID := o.PluginID
	if pluginID == "" {
		pluginID = unknownPlugin
	}
	source := sourceLabel(o.Source)
	m.requests.WithLabelValues(pluginID, statusCodeLabel(o.Status), source).Inc()
	m.duration.WithLabelValues(pluginID, statusClass(o.Status)).Observe(o.Duration.Seconds())

	failed := o.Status >= 500 || source != SourceServer
	if failed || m.seen.Add(1)%sampleEvery == 0 {
		m.logRequest(o, pluginID, source, failed)
	}
}

func (m *Metrics) logRequest(o Observation, pluginID, source string, failed bool) {
	logFn := m.log.Info
	if failed {
		logFn = m.log.Warn
	}
	logFn("Proxied datasource request",
		"pluginId", pluginID,
		"datasourceUid", o.DatasourceUID,
		"namespace", o.Namespace,
		"method", o.Method,
		"path", loggedPath(o.Path),
		"status", o.Status,
		"statusSource", source,
		"duration", o.Duration,
	)
}

// loggedPath drops the query string, which can carry user data such as query
// expressions, and bounds the length.
func loggedPath(path string) string {
	if i := strings.IndexAny(path, "?#"); i >= 0 {
		path = path[:i]
	}
	if len(path) > maxLoggedPath {
		path = path[:maxLoggedPath]
	}
	return path
}

func statusCodeLabel(status int) string {
	if status < 100 || status > 599 {
		return "0"
	}
	return strconv.Itoa(status)
}

func statusClass(status int) string {
	if status < 100 || status > 599 {
		return "unknown"
	}
	return strconv.Itoa(status/100) + "xx"
}

func sourceLabel(source string) string {
	switch source {
	case SourceServer, SourceDownstream, SourceClient:
		return source
	default:
		return SourceServer
	}
}

// ClassifySource decides who produced status. A canceled request is the
// client's, even though the shared reverse proxy tags it as downstream.
// Otherwise it trusts the status source the reverse proxy recorded on the request.
func ClassifySource(status int, recorded requestmeta.StatusSource) string {
	switch {
	case status == 499:
		return SourceClient
	case recorded == requestmeta.StatusSourceDownstream:
		return SourceDownstream
	default:
		return SourceServer
	}
}

// StatusRecorder records the final status written to the wrapped ResponseWriter.
type StatusRecorder struct {
	http.ResponseWriter
	status int
}

// NewStatusRecorder wraps w.
func NewStatusRecorder(w http.ResponseWriter) *StatusRecorder {
	return &StatusRecorder{ResponseWriter: w}
}

// Unwrap lets http.ResponseController reach the wrapped writer's Flusher and
// Hijacker, which the reverse proxy needs for streaming and protocol upgrades.
func (r *StatusRecorder) Unwrap() http.ResponseWriter { return r.ResponseWriter }

func (r *StatusRecorder) WriteHeader(code int) {
	// Informational responses are not the final status. 101 ends the exchange.
	if r.status == 0 && (code >= 200 || code == http.StatusSwitchingProtocols) {
		r.status = code
	}
	r.ResponseWriter.WriteHeader(code)
}

func (r *StatusRecorder) Write(b []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	return r.ResponseWriter.Write(b)
}

func (r *StatusRecorder) Flush() {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	_ = http.NewResponseController(r.ResponseWriter).Flush()
}

// Status returns the recorded status, or 200 if nothing was written, which is what net/http sends.
func (r *StatusRecorder) Status() int {
	if r.status == 0 {
		return http.StatusOK
	}
	return r.status
}

// Package proxymetrics records the outcome of requests proxied to a datasource,
// in the same shape for the legacy /api/datasources/proxy handler and the
// /apis/.../proxy subresource, so both can be compared and queried together.
package proxymetrics

import (
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

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
	otherRoute    = "other"
	idSegment     = ":id"

	// maxRouteClassesPerPlugin bounds the route_class label. Route classes are
	// derived from request paths, which datasources and callers control, so the
	// normalisation alone cannot guarantee a bounded set of values.
	maxRouteClassesPerPlugin = 64
	maxRouteSegments         = 3
	maxSegmentLength         = 32
)

// Metrics holds the proxy collectors. The zero value and nil are valid and record nothing.
type Metrics struct {
	requests *prometheus.CounterVec
	duration *prometheus.HistogramVec

	mu     sync.Mutex
	routes map[string]map[string]struct{}
}

// New registers the proxy collectors on reg with a constant variant label. Two
// components that proxy in one process, such as the legacy handler and the /apis
// subresource, share the metric names and differ only by variant.
func New(reg prometheus.Registerer, variant string) *Metrics {
	factory := promauto.With(reg)
	constLabels := prometheus.Labels{"variant": variant}

	return &Metrics{
		routes: make(map[string]map[string]struct{}),
		requests: factory.NewCounterVec(prometheus.CounterOpts{
			Name:        "grafana_datasource_proxy_requests_total",
			Help:        "Total requests proxied to a datasource, by plugin, route class, status code and status source.",
			ConstLabels: constLabels,
		}, []string{"plugin_id", "route_class", "method", "status_code", "status_source"}),
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
	Method   string
	// Path is the path forwarded to the datasource, without the proxy prefix.
	Path     string
	Status   int
	Source   string
	Duration time.Duration
}

// Observe records one finished request.
func (m *Metrics) Observe(o Observation) {
	if m == nil {
		return
	}
	pluginID := o.PluginID
	if pluginID == "" {
		pluginID = unknownPlugin
	}
	m.requests.WithLabelValues(
		pluginID,
		m.boundRoute(pluginID, RouteClass(o.Path)),
		methodLabel(o.Method),
		statusCodeLabel(o.Status),
		sourceLabel(o.Source),
	).Inc()
	m.duration.WithLabelValues(pluginID, statusClass(o.Status)).Observe(o.Duration.Seconds())
}

// boundRoute returns route, or "other" once a plugin already has the maximum
// number of distinct route classes.
func (m *Metrics) boundRoute(pluginID, route string) string {
	m.mu.Lock()
	defer m.mu.Unlock()
	seen := m.routes[pluginID]
	if seen == nil {
		seen = make(map[string]struct{})
		m.routes[pluginID] = seen
	}
	if _, ok := seen[route]; ok {
		return route
	}
	if len(seen) >= maxRouteClassesPerPlugin {
		return otherRoute
	}
	seen[route] = struct{}{}
	return route
}

// RouteClass reduces a forwarded path to a low-cardinality label: the first
// three segments, with segments that look like identifiers replaced by ":id".
// API version segments such as "v1" are kept and do not count towards the three,
// so "loki/api/v1/query" keeps its operation.
func RouteClass(path string) string {
	if i := strings.IndexAny(path, "?#"); i >= 0 {
		path = path[:i]
	}
	path = strings.Trim(path, "/")
	if path == "" {
		return "/"
	}
	var kept []string
	named := 0
	for _, s := range strings.Split(path, "/") {
		if isVersionSegment(s) {
			kept = append(kept, s)
			continue
		}
		if named == maxRouteSegments {
			break
		}
		named++
		if looksLikeIdentifier(s) {
			s = idSegment
		}
		kept = append(kept, s)
	}
	return "/" + strings.Join(kept, "/")
}

// isVersionSegment matches "v1", "v2", "v1beta1", "v1alpha2".
func isVersionSegment(s string) bool {
	if len(s) < 2 || s[0] != 'v' || s[1] < '0' || s[1] > '9' {
		return false
	}
	for _, r := range s[1:] {
		if (r < '0' || r > '9') && (r < 'a' || r > 'z') {
			return false
		}
	}
	return len(s) <= 12
}

// looksLikeIdentifier reports whether a path segment is probably a value (an
// id, a name, a date-stamped index) rather than part of a fixed route.
func looksLikeIdentifier(s string) bool {
	if s == "" || len(s) > maxSegmentLength {
		return true
	}
	for _, r := range s {
		switch {
		case r >= '0' && r <= '9':
			return true
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r == '_', r == '-', r == '.':
		default:
			return true
		}
	}
	return false
}

func methodLabel(method string) string {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodPost, http.MethodPut,
		http.MethodPatch, http.MethodDelete, http.MethodOptions:
		return method
	default:
		return "other"
	}
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

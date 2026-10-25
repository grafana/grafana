package router

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/sony/gobreaker/v2"
)

// unknownGroupLabel replaces groups the router does not serve, so arbitrary
// client paths cannot create new series.
const unknownGroupLabel = "unknown"

// routerMetrics is the router's request and event instrumentation. Like the
// Kubernetes apiserver, it counts every request, but keeps long-running
// requests (watches) out of the duration histogram and the in-flight gauge,
// so one watch lasting half an hour doesn't distort latency or look like
// load. Route state, such as the groups served and breaker states, is read at
// scrape time by routerCollector.
type routerMetrics struct {
	inFlight           prometheus.Gauge
	longRunning        *prometheus.GaugeVec
	requests           *prometheus.CounterVec
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
		requests: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "router",
			Name:      "http_requests_total",
			Help:      "Requests served by the router, watches included, by group, verb, route (backend, fallback, discovery, next, invalid or unauthenticated) and status code.",
		}, []string{"group", "verb", "route", "status_code"}),
		// No status code, as in Kubernetes: it would multiply the histogram's
		// series, and grafana_router_http_requests_total carries it.
		duration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       "grafana",
			Subsystem:                       "router",
			Name:                            "http_request_duration_seconds",
			Help:                            "Latency of requests, other than watches, served by the router, by group, verb and route (backend, fallback, discovery, next, invalid or unauthenticated).",
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"group", "verb", "route"}),
		backendFailures: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "router",
			Name:      "backend_failures_total",
			Help:      "Requests whose backend could not be reached or answered, by group, plugin ID (empty for other backends) and reason: breaker_open, timeout, transport, redirect_rejected, stack_origin_mismatch or auth.",
		}, []string{"group", "plugin_id", "reason"}),
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
	m.inFlight = registerOrReuse(reg, m.inFlight)
	m.longRunning = registerOrReuse(reg, m.longRunning)
	m.requests = registerOrReuse(reg, m.requests)
	m.duration = registerOrReuse(reg, m.duration)
	m.backendFailures = registerOrReuse(reg, m.backendFailures)
	m.breakerTransitions = registerOrReuse(reg, m.breakerTransitions)
	m.discoveryResults = registerOrReuse(reg, m.discoveryResults)
	return m
}

// registerOrReuse registers c with reg, or returns the identical collector
// already registered there, so building the router twice on one registry, as
// tests and some module combinations do, shares its metrics instead of
// panicking. A conflicting definition is a programming error, and panics.
func registerOrReuse[C prometheus.Collector](reg prometheus.Registerer, c C) C {
	err := reg.Register(c)
	if err == nil {
		return c
	}
	var already prometheus.AlreadyRegisteredError
	if errors.As(err, &already) {
		if existing, ok := already.ExistingCollector.(C); ok {
			return existing
		}
	}
	panic(err)
}

func (m *routerMetrics) breakerChanged(group string, to gobreaker.State) {
	m.breakerTransitions.WithLabelValues(group, to.String()).Inc()
}

func (m *routerMetrics) discoveryResult(group, result string) {
	m.discoveryResults.WithLabelValues(group, result).Inc()
}

// newPluginGRPCRequestDuration returns the histogram of gRPC calls to plugin
// deployments, registered with reg unless it is nil. Local plugins are
// measured by the plugin client's grafana_plugin_request_* metrics instead.
// The source const label lets plugins_url and core_url register on one registry.
func newPluginGRPCRequestDuration(reg prometheus.Registerer, source string) *prometheus.HistogramVec {
	h := prometheus.NewHistogramVec(prometheus.HistogramOpts{
		ConstLabels:                     prometheus.Labels{"source": source},
		Namespace:                       "grafana",
		Subsystem:                       "router",
		Name:                            "plugin_grpc_request_duration_seconds",
		Help:                            "Latency of gRPC calls to plugin deployments, by plugin, gRPC method and status code.",
		NativeHistogramBucketFactor:     1.1,
		NativeHistogramMaxBucketNumber:  160,
		NativeHistogramMinResetDuration: time.Hour,
	}, []string{"plugin_id", "method", "status_code"})
	if reg != nil {
		h = registerOrReuse(reg, h)
	}
	return h
}

// newPluginGRPCRequestRetries returns the counter of retried unary gRPC calls
// to plugin deployments, registered with reg unless it is nil. Like the
// request duration, the source const label lets plugins_url and core_url
// register on one registry.
func newPluginGRPCRequestRetries(reg prometheus.Registerer, source string) *prometheus.CounterVec {
	c := prometheus.NewCounterVec(prometheus.CounterOpts{
		ConstLabels: prometheus.Labels{"source": source},
		Name:        "grafana_router_plugin_grpc_request_retries_total",
		Help:        "Retries of unary gRPC calls to plugin deployments, by plugin and gRPC method.",
	}, []string{"plugin_id", "method"})
	if reg != nil {
		c = registerOrReuse(reg, c)
	}
	return c
}

// requestGroup returns the group a request is for: the group of an
// /apis/<group>/... path, as apiGroup reads it, or of an
// /openapi/v3/apis/<group>/<version> document, which is served by the same
// backend. The /apis/discovery tree has no group.
func requestGroup(path, group string) string {
	if isDiscoveryPath(path) {
		return ""
	}
	if group, _, ok := parseOpenAPIGroupVersionPath(path); ok {
		if group == discoveryGroup {
			return ""
		}
		return group
	}
	return group
}

// namesGroup reports whether path has a non-empty segment after /apis/,
// outside the discovery tree, even when that segment is not a valid group or
// the path is not canonical. Its metrics then count under unknownGroupLabel,
// not the root's empty group.
func namesGroup(path string) bool {
	rest, ok := strings.CutPrefix(path, apisPrefix+"/")
	segment, _, _ := strings.Cut(rest, "/")
	return ok && segment != "" && !isDiscoveryPath(path)
}

// instrument serves req through gr.handle with request metrics, then logs
// the outcome. next and apiGroup, the request's apiGroup, are forwarded to
// handle unchanged.
func (m *routerMetrics) instrument(gr *GrafanaRouter, w http.ResponseWriter, req *http.Request, next http.Handler, apiGroup string) {
	group := requestGroup(req.URL.Path, apiGroup)
	metricGroup := group
	if group != "" && !gr.KnownGroup(group) || group == "" && namesGroup(req.URL.Path) {
		metricGroup = unknownGroupLabel
	}
	start := time.Now()
	rec := newStatusRecorder(w)
	req, outcome := withRequestOutcome(req)
	// Recorded on outcome, so the router doesn't parse the request again.
	verb := metricVerb(requestVerb(req))
	route := func() string {
		if outcome.route == "" {
			return routeNext
		}
		return outcome.route
	}
	// The router rejects a non-canonical path before routing, so it is no
	// group's request, even when its first segment names a served group.
	resultGroup := func() string {
		if outcome.route == routeInvalid && metricGroup != "" {
			return unknownGroupLabel
		}
		return metricGroup
	}
	finish := func(duration time.Duration) {
		m.requests.WithLabelValues(resultGroup(), verb, route(), strconv.Itoa(rec.status)).Inc()
		if outcome.failure != "" {
			m.backendFailures.WithLabelValues(resultGroup(), outcome.pluginID, outcome.failure).Inc()
		}
		logRequest(req, group, rec.status, duration)
	}

	if verb == "watch" {
		m.longRunning.WithLabelValues(metricGroup).Inc()
		defer m.longRunning.WithLabelValues(metricGroup).Dec()
		defer func() { finish(time.Since(start)) }()
		gr.handle(rec.writer(), req, next, apiGroup)
		return
	}

	m.inFlight.Inc()
	defer m.inFlight.Dec()
	gr.handle(rec.writer(), req, next, apiGroup)
	duration := time.Since(start)
	m.duration.WithLabelValues(resultGroup(), verb, route()).Observe(duration.Seconds())
	finish(duration)
}

// metricVerbs are the verb label's values: the Kubernetes verbs, plus the
// lowercased HTTP methods that paths outside the resource API report.
var metricVerbs = map[string]bool{
	"get": true, "list": true, "watch": true, "create": true, "update": true, "patch": true,
	"delete": true, "deletecollection": true, "proxy": true,
	"head": true, "options": true, "post": true, "put": true, "connect": true, "trace": true,
}

// metricVerb limits verb to metricVerbs. A request can carry any method, and
// each distinct value would otherwise create new series.
func metricVerb(verb string) string {
	if metricVerbs[verb] {
		return verb
	}
	return "other"
}

// routerCollector exports route state, read from the router when scraped, so
// nothing needs updating as routes change and group labels stay limited to
// served groups.
type routerCollector struct {
	router *GrafanaRouter

	ready           *prometheus.Desc
	lastReconcile   *prometheus.Desc
	reconciles      *prometheus.Desc
	reconcileErrors *prometheus.Desc
	groups          *prometheus.Desc
	breaker         *prometheus.Desc
	shadowed        *prometheus.Desc
	skipped         *prometheus.Desc
	lastSuccess     *prometheus.Desc
	polls           *prometheus.Desc
	stackLookups    *prometheus.Desc
	stackDiscovery  *prometheus.Desc
	stackRefused    *prometheus.Desc
}

func newRouterCollector(router *GrafanaRouter) *routerCollector {
	name := func(n string) string { return prometheus.BuildFQName("grafana", "router", n) }
	return &routerCollector{
		router: router,
		ready: prometheus.NewDesc(name("ready"),
			"Whether the router is ready to serve traffic: 1 ready, 0 not.", nil, nil),
		lastReconcile: prometheus.NewDesc(name("last_reconcile_timestamp_seconds"),
			"When the latest route reconcile finished, in seconds since the Unix epoch.", nil, nil),
		reconciles: prometheus.NewDesc(name("reconciles_total"),
			"Number of completed route reconciles.", nil, nil),
		reconcileErrors: prometheus.NewDesc(name("reconcile_errors_total"),
			"Number of route reconciles that completed with errors.", nil, nil),
		groups: prometheus.NewDesc(name("groups"),
			"Number of API groups the router serves, by route source.", []string{"source"}, nil),
		breaker: prometheus.NewDesc(name("breaker_state"),
			"Circuit breaker state of each group: 1 for its current state (closed, half-open or open), 0 for the others.", []string{"group", "state"}, nil),
		shadowed: prometheus.NewDesc(name("shadowed_groups"),
			"Number of API groups a source other than the single-tenant fallback offered that a higher-priority source serves instead, in the latest load.", []string{"source"}, nil),
		skipped: prometheus.NewDesc(name("skipped_backends"),
			"Number of backends a route source skipped in its latest successful load or poll. Each skip is logged with its error.", []string{"source"}, nil),
		lastSuccess: prometheus.NewDesc(name("source_last_success_timestamp_seconds"),
			"When each route source last loaded successfully, in seconds since the Unix epoch.", []string{"source"}, nil),
		polls: prometheus.NewDesc(name("source_polls_total"),
			"Load or poll attempts of each route source, by result: success or failure.", []string{"source", "result"}, nil),
		stackLookups: prometheus.NewDesc(name("stack_lookups_total"),
			"Single-tenant stack lookups, by result: cache_hit, resolved, not_found, throttled or error.", []string{"result"}, nil),
		stackDiscovery: prometheus.NewDesc(name("stack_discovery_cache_total"),
			"Single-tenant discovery requests looked up in the cache shared by each stack's callers, by result: hit or miss.", []string{"result"}, nil),
		stackRefused: prometheus.NewDesc(name("stack_fallback_refused_total"),
			"Requests the single-tenant fallback refused with a 404 because a stack had already forwarded them to the router.", nil, nil),
	}
}

func (c *routerCollector) Describe(ch chan<- *prometheus.Desc) {
	for _, d := range []*prometheus.Desc{
		c.ready, c.lastReconcile, c.reconciles, c.reconcileErrors, c.groups, c.breaker,
		c.shadowed, c.skipped, c.lastSuccess, c.polls, c.stackLookups, c.stackDiscovery, c.stackRefused,
	} {
		ch <- d
	}
}

var breakerStates = []gobreaker.State{gobreaker.StateClosed, gobreaker.StateHalfOpen, gobreaker.StateOpen}

func (c *routerCollector) Collect(ch chan<- prometheus.Metric) {
	ready := 0.0
	if c.router.Ready(context.Background()) == nil {
		ready = 1
	}
	ch <- prometheus.MustNewConstMetric(c.ready, prometheus.GaugeValue, ready)
	if ns := c.router.lastReconcile.Load(); ns != 0 {
		ch <- prometheus.MustNewConstMetric(c.lastReconcile, prometheus.GaugeValue, float64(ns)/1e9)
	}
	ch <- prometheus.MustNewConstMetric(c.reconciles, prometheus.CounterValue, float64(c.router.reconciles.Load()))
	ch <- prometheus.MustNewConstMetric(c.reconcileErrors, prometheus.CounterValue, float64(c.router.reconcileErrors.Load()))

	perSource := map[string]int{}
	for group, entry := range *c.router.snapshot.Load() {
		perSource[entry.source]++
		// The single-tenant fallback keeps a breaker per stack, not per group.
		if _, perDestination := entry.handler.(interface{ managesCircuitBreaking() }); perDestination || entry.breaker == nil {
			continue
		}
		current := entry.breakerState()
		for _, state := range breakerStates {
			value := 0.0
			if state == current {
				value = 1
			}
			ch <- prometheus.MustNewConstMetric(c.breaker, prometheus.GaugeValue, value, group, state.String())
		}
	}
	for source, n := range perSource {
		ch <- prometheus.MustNewConstMetric(c.groups, prometheus.GaugeValue, float64(n), source)
	}

	status, ok := c.router.loader.(loaderStatus)
	if !ok {
		return
	}
	shadowed := map[string]int{}
	for _, s := range status.shadowedGroups() {
		shadowed[s.Source]++
	}
	for source, n := range shadowed {
		ch <- prometheus.MustNewConstMetric(c.shadowed, prometheus.GaugeValue, float64(n), source)
	}
	for _, s := range status.sourceStatuses() {
		if !s.LastSuccess.IsZero() {
			ch <- prometheus.MustNewConstMetric(c.lastSuccess, prometheus.GaugeValue, float64(s.LastSuccess.UnixNano())/1e9, s.Source)
		}
		ch <- prometheus.MustNewConstMetric(c.polls, prometheus.CounterValue, float64(s.Successes), s.Source, "success")
		ch <- prometheus.MustNewConstMetric(c.polls, prometheus.CounterValue, float64(s.Failures), s.Source, "failure")
		ch <- prometheus.MustNewConstMetric(c.skipped, prometheus.GaugeValue, float64(s.Skipped), s.Source)
	}
	for result, n := range status.stackLookups() {
		ch <- prometheus.MustNewConstMetric(c.stackLookups, prometheus.CounterValue, float64(n), result)
	}
	for result, n := range status.stackDiscoveryCache() {
		ch <- prometheus.MustNewConstMetric(c.stackDiscovery, prometheus.CounterValue, float64(n), result)
	}
	if n, ok := status.stackFallbackRefused(); ok {
		ch <- prometheus.MustNewConstMetric(c.stackRefused, prometheus.CounterValue, float64(n))
	}
}

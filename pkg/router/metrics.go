package router

import (
	"context"
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

// requestGroup returns the group a request is for: the group of an
// /apis/<group>/... path, or of an /openapi/v3/apis/<group>/<version>
// document, which is served by the same backend.
func requestGroup(path string) string {
	if group, _, ok := parseOpenAPIGroupVersionPath(path); ok {
		return group
	}
	return GroupFromPath(path)
}

// instrument serves req through gr.HandleFunc with request metrics, then logs
// the outcome. next is forwarded to HandleFunc unchanged.
func (m *routerMetrics) instrument(gr *GrafanaRouter, w http.ResponseWriter, req *http.Request, next http.Handler) {
	group := requestGroup(req.URL.Path)
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
	lastSuccess     *prometheus.Desc
	polls           *prometheus.Desc
	stackLookups    *prometheus.Desc
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
			"Number of API groups a source offered that a higher-priority source serves instead, in the latest load.", []string{"source"}, nil),
		lastSuccess: prometheus.NewDesc(name("source_last_success_timestamp_seconds"),
			"When each route source last loaded successfully, in seconds since the Unix epoch.", []string{"source"}, nil),
		polls: prometheus.NewDesc(name("source_polls_total"),
			"Load or poll attempts of each route source, by result: success or failure.", []string{"source", "result"}, nil),
		stackLookups: prometheus.NewDesc(name("stack_lookups_total"),
			"Single-tenant stack lookups, by result: cache_hit, resolved, not_found, throttled or error.", []string{"result"}, nil),
	}
}

func (c *routerCollector) Describe(ch chan<- *prometheus.Desc) {
	for _, d := range []*prometheus.Desc{
		c.ready, c.lastReconcile, c.reconciles, c.reconcileErrors, c.groups, c.breaker,
		c.shadowed, c.lastSuccess, c.polls, c.stackLookups,
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
		current := entry.breaker.State()
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
	}
	for result, n := range status.stackLookups() {
		ch <- prometheus.MustNewConstMetric(c.stackLookups, prometheus.CounterValue, float64(n), result)
	}
}

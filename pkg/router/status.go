package router

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/sony/gobreaker/v2"
)

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
		perSource[entry.source.Source]++
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

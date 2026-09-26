package router

import (
	"encoding/json"
	"net/http"
	"sort"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana-app-sdk/logging"
)

// breakerState describes a group's circuit breaker. The ST fallback keeps one
// breaker per stack instead, so it has no single group state.
func breakerState(entry servingEntry) string {
	if _, perDestination := entry.handler.(interface{ managesCircuitBreaking() }); perDestination {
		return "per-destination"
	}
	if entry.breaker == nil {
		return ""
	}
	return entry.breaker.State().String()
}

// routerCollector exports route state, read from the router when scraped, so
// nothing needs updating as routes change and group labels stay limited to
// served groups.
type routerCollector struct {
	router *GrafanaRouter

	groups          *prometheus.Desc
	breaker         *prometheus.Desc
	reconciles      *prometheus.Desc
	reconcileErrors *prometheus.Desc
	shadowed        *prometheus.Desc
	lastSuccess     *prometheus.Desc
}

func newRouterCollector(router *GrafanaRouter) *routerCollector {
	name := func(n string) string { return prometheus.BuildFQName("grafana", "router", n) }
	return &routerCollector{
		router: router,
		groups: prometheus.NewDesc(name("groups"),
			"Number of API groups the router serves, by route source.", []string{"source"}, nil),
		breaker: prometheus.NewDesc(name("breaker_state"),
			"State of each group's circuit breaker: 0 closed, 1 half-open, 2 open.", []string{"group"}, nil),
		reconciles: prometheus.NewDesc(name("reconciles_total"),
			"Number of completed route reconciles.", nil, nil),
		reconcileErrors: prometheus.NewDesc(name("reconcile_errors_total"),
			"Number of route reconciles that completed with errors.", nil, nil),
		shadowed: prometheus.NewDesc(name("shadowed_groups"),
			"Number of API groups a source offered that a higher-priority source serves instead, in the latest load.", []string{"source"}, nil),
		lastSuccess: prometheus.NewDesc(name("source_last_success_timestamp_seconds"),
			"When each route source last loaded successfully, in seconds since the Unix epoch.", []string{"source"}, nil),
	}
}

func (c *routerCollector) Describe(ch chan<- *prometheus.Desc) {
	for _, d := range []*prometheus.Desc{c.groups, c.breaker, c.reconciles, c.reconcileErrors, c.shadowed, c.lastSuccess} {
		ch <- d
	}
}

func (c *routerCollector) Collect(ch chan<- prometheus.Metric) {
	perSource := map[string]int{}
	for group, entry := range *c.router.snapshot.Load() {
		perSource[entry.source.Source]++
		if _, perDestination := entry.handler.(interface{ managesCircuitBreaking() }); !perDestination && entry.breaker != nil {
			ch <- prometheus.MustNewConstMetric(c.breaker, prometheus.GaugeValue, float64(entry.breaker.State()), group)
		}
	}
	for source, n := range perSource {
		ch <- prometheus.MustNewConstMetric(c.groups, prometheus.GaugeValue, float64(n), source)
	}
	ch <- prometheus.MustNewConstMetric(c.reconciles, prometheus.CounterValue, float64(c.router.reconciles.Load()))
	ch <- prometheus.MustNewConstMetric(c.reconcileErrors, prometheus.CounterValue, float64(c.router.reconcileErrors.Load()))

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
	}
}

// routerDebugState is the router's state as the debug endpoint reports it.
type routerDebugState struct {
	Ready              bool            `json:"ready"`
	NotReadyReason     string          `json:"notReadyReason,omitempty"`
	Reconciles         uint64          `json:"reconciles"`
	ReconcileErrors    uint64          `json:"reconcileErrors"`
	LastReconcileError string          `json:"lastReconcileError,omitempty"`
	Groups             []debugGroup    `json:"groups"`
	Shadowed           []shadowedGroup `json:"shadowed,omitempty"`
	Sources            []sourceStatus  `json:"sources,omitempty"`
}

type debugGroup struct {
	Group    string   `json:"group"`
	Versions []string `json:"versions"`
	BackendDescription
	Key     string `json:"key"`
	Breaker string `json:"breaker,omitempty"`
}

func (r *GrafanaRouter) debugState(req *http.Request) routerDebugState {
	state := routerDebugState{
		Reconciles:      r.reconciles.Load(),
		ReconcileErrors: r.reconcileErrors.Load(),
		Groups:          []debugGroup{},
	}
	if err := r.Ready(req.Context()); err != nil {
		state.NotReadyReason = err.Error()
	} else {
		state.Ready = true
	}
	if s := r.state.Load(); s != nil && s.err != nil {
		state.LastReconcileError = s.err.Error()
	}
	for group, entry := range *r.snapshot.Load() {
		versions := make([]string, 0, len(entry.group.Versions))
		for _, v := range entry.group.Versions {
			versions = append(versions, v.Version)
		}
		state.Groups = append(state.Groups, debugGroup{
			Group: group, Versions: versions, BackendDescription: entry.source,
			Key: entry.key, Breaker: breakerState(entry),
		})
	}
	sort.Slice(state.Groups, func(i, j int) bool { return state.Groups[i].Group < state.Groups[j].Group })
	if status, ok := r.loader.(loaderStatus); ok {
		state.Shadowed = status.shadowedGroups()
		state.Sources = status.sourceStatuses()
	}
	return state
}

// serveDebug writes the router's current state as JSON. It is read-only and
// mounted only on the standalone router's internal listener, next to /metrics.
func (r *GrafanaRouter) serveDebug(w http.ResponseWriter, req *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(r.debugState(req)); err != nil {
		logging.FromContext(req.Context()).Warn("router: writing debug state failed", "err", err)
	}
}

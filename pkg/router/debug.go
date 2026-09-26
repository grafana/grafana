package router

import (
	"encoding/json"
	"net/http"
	"sort"

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

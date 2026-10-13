package router

import (
	"encoding/json"
	"net/http"
	"sort"
	"time"

	"github.com/sony/gobreaker/v2"

	"github.com/grafana/grafana-app-sdk/logging"
)

const manifestDiscoveryStatus = manifestDiscoveryPrefix + "/status"

// routerStatusDoc is the router's live status, for debugging. Any
// authenticated caller can read it, so it holds no credentials, addresses,
// URLs or error text: only names, states and counts.
type routerStatusDoc struct {
	Phase string `json:"phase"`
	Ready bool   `json:"ready"`
	// LastReconcileFailed is whether the latest reconcile left some group
	// on its last-known-good backend.
	LastReconcileFailed bool               `json:"lastReconcileFailed"`
	LastReconcile       *time.Time         `json:"lastReconcile,omitempty"`
	Reconciles          uint64             `json:"reconciles"`
	ReconcileErrors     uint64             `json:"reconcileErrors"`
	Breakers            breakerSettingsDoc `json:"breakers"`
	Groups              []groupStatusDoc   `json:"groups"`
	Sources             []sourceStatus     `json:"sources,omitempty"`
	Shadowed            []shadowedGroup    `json:"shadowed,omitempty"`
	StackLookups        map[string]uint64  `json:"stackLookups,omitempty"`
}

type breakerSettingsDoc struct {
	OpenAfterConsecutiveFailures int    `json:"openAfterConsecutiveFailures"`
	OpenFor                      string `json:"openFor"`
}

type groupStatusDoc struct {
	Group  string `json:"group"`
	Source string `json:"source"`
	Key    string `json:"key"`
	// Health summarizes the breaker: ok, degraded (failing, still closed),
	// recovering (half-open), unavailable (open), or unknown when the group
	// has no breaker of its own.
	Health   string           `json:"health"`
	Breaker  breakerStatusDoc `json:"breaker"`
	Plugin   *PluginStatus    `json:"plugin,omitempty"`
	LoadedAt time.Time        `json:"loadedAt"`
	Manifest bool             `json:"manifest"`
	// Discovery is where the group's aggregated discovery comes from:
	// provided by the backend, cached, expired (refetched on the next
	// request), or not cached yet.
	Discovery     string   `json:"discovery"`
	OpenAPICached []string `json:"openapiCached,omitempty"`
	Watches       int64    `json:"watches"`
}

// breakerStatusDoc reports a group's breaker. Its counts start when the
// group's backend was loaded, and reset when the breaker changes state.
type breakerStatusDoc struct {
	// Scope is what the breaker counts: proxied requests, the plugin's client
	// calls, or nothing here, when the single-tenant fallback keeps a breaker
	// per destination instead.
	Scope               string `json:"scope"`
	State               string `json:"state,omitempty"`
	Requests            uint32 `json:"requests"`
	Successes           uint32 `json:"successes"`
	Failures            uint32 `json:"failures"`
	ConsecutiveFailures uint32 `json:"consecutiveFailures"`
	// FailuresUntilOpen is how many more consecutive failures open a closed
	// breaker.
	FailuresUntilOpen uint32 `json:"failuresUntilOpen,omitempty"`
}

var phaseNames = map[phase]string{starting: "starting", serving: "serving", stopped: "stopped", crashed: "crashed"}

// serveRouterStatus serves the live status. It is built per request, since
// breaker counts and watches change all the time.
func (r *GrafanaRouter) serveRouterStatus(w http.ResponseWriter, req *http.Request) {
	body, err := json.MarshalIndent(r.routerStatus(req), "", "  ")
	if err != nil {
		logging.FromContext(req.Context()).Error("router: failed to marshal status", "error", err)
		http.Error(w, "failed to marshal status", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}

func (r *GrafanaRouter) routerStatus(req *http.Request) routerStatusDoc {
	doc := routerStatusDoc{
		Phase:           phaseNames[starting],
		Ready:           r.Ready(req.Context()) == nil,
		Reconciles:      r.reconciles.Load(),
		ReconcileErrors: r.reconcileErrors.Load(),
		Breakers:        breakerSettingsDoc{OpenAfterConsecutiveFailures: breakerOpenAfter, OpenFor: breakerOpenFor.String()},
		Groups:          []groupStatusDoc{},
	}
	if s := r.state.Load(); s != nil {
		doc.Phase = phaseNames[s.phase]
		doc.LastReconcileFailed = s.err != nil
	}
	if ns := r.lastReconcile.Load(); ns != 0 {
		t := time.Unix(0, ns).UTC()
		doc.LastReconcile = &t
	}
	if status, ok := r.loader.(loaderStatus); ok {
		doc.Sources = status.sourceStatuses()
		doc.Shadowed = status.shadowedGroups()
		doc.StackLookups = status.stackLookups()
	}

	for name, entry := range *r.snapshot.Load() {
		doc.Groups = append(doc.Groups, r.groupStatus(name, entry))
	}
	sort.Slice(doc.Groups, func(i, j int) bool { return doc.Groups[i].Group < doc.Groups[j].Group })
	return doc
}

func (r *GrafanaRouter) groupStatus(name string, entry servingEntry) groupStatusDoc {
	g := groupStatusDoc{
		Group:    name,
		Source:   entry.source,
		Key:      entry.key,
		Plugin:   entry.plugin,
		LoadedAt: entry.loadedAt.UTC(),
		Manifest: entry.hasManifest,
	}
	if entry.watching != nil {
		g.Watches = entry.watching.Load()
	}
	for _, v := range entry.group.Versions {
		if cached, ok := r.openapiDocs.Load(name + "/" + v.Version); ok && cached.(openapiCacheEntry).key == entry.key {
			g.OpenAPICached = append(g.OpenAPICached, v.Version)
		}
	}

	switch _, found, fresh := r.discoveryCache.lookup(name, entry.key); {
	case entry.discovery != nil:
		g.Discovery = "provided"
	case found && fresh:
		g.Discovery = "cached"
	case found:
		g.Discovery = "expired"
	default:
		g.Discovery = "not-cached"
	}

	g.Health, g.Breaker = breakerStatus(entry)
	return g
}

func breakerStatus(entry servingEntry) (health string, b breakerStatusDoc) {
	if _, perDestination := entry.handler.(interface{ managesCircuitBreaking() }); perDestination || entry.breaker == nil {
		return "unknown", breakerStatusDoc{Scope: "per-destination"}
	}
	b.Scope = "requests"
	if _, clientScoped := entry.handler.(interface{ breaksOnClientCalls() }); clientScoped {
		b.Scope = "plugin-calls"
	}
	state, counts := entry.breaker.State(), entry.breaker.Counts()
	b.State = state.String()
	b.Requests, b.Successes, b.Failures = counts.Requests, counts.TotalSuccesses, counts.TotalFailures
	b.ConsecutiveFailures = counts.ConsecutiveFailures

	switch state {
	case gobreaker.StateOpen:
		return "unavailable", b
	case gobreaker.StateHalfOpen:
		return "recovering", b
	case gobreaker.StateClosed:
	}
	b.FailuresUntilOpen = breakerOpenAfter - min(counts.ConsecutiveFailures, breakerOpenAfter)
	if counts.ConsecutiveFailures > 0 {
		return "degraded", b
	}
	return "ok", b
}

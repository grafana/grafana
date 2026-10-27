package router

import (
	"encoding/json"
	"maps"
	"net/http"
	"slices"
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
	Ready        bool               `json:"ready"`
	Reconciler   reconcilerDoc      `json:"reconciler"`
	Breakers     breakerSettingsDoc `json:"breakers"`
	Groups       []groupStatusDoc   `json:"groups"`
	LoadFailures []loadFailureDoc   `json:"loadFailures,omitempty"`
	Sources      []sourceStatus     `json:"sources,omitempty"`
	Shadowed     []shadowedGroup    `json:"shadowed,omitempty"`
	// Counters are the loader's counters with a status field, by that field.
	// Each is written as a field of the document (MarshalJSON), such as the
	// single-tenant fallback's stackLookups.
	Counters map[string]map[string]uint64 `json:"-"`
}

// MarshalJSON writes the document with each of its Counters as a field of
// its own, after the others.
func (d routerStatusDoc) MarshalJSON() ([]byte, error) {
	type plain routerStatusDoc
	body, err := json.Marshal(plain(d))
	if err != nil || len(d.Counters) == 0 {
		return body, err
	}
	body = body[:len(body)-1] // the closing brace; the document always has fields
	for _, name := range slices.Sorted(maps.Keys(d.Counters)) {
		field, err := json.Marshal(map[string]map[string]uint64{name: d.Counters[name]})
		if err != nil {
			return nil, err
		}
		body = append(append(body, ','), field[1:len(field)-1]...)
	}
	return append(body, '}'), nil
}

// reconcilerDoc reports the reconcile loop.
type reconcilerDoc struct {
	// Phase is the loop's state: starting (before the first reconcile),
	// serving, stopped, or crashed.
	Phase string `json:"phase"`
	// Last is when the latest reconcile finished, and LastFailed whether it
	// left some group on its last-known-good backend.
	Last       *time.Time `json:"last,omitempty"`
	LastFailed bool       `json:"lastFailed"`
	// Total and Errors count reconciles since the router started.
	Total  uint64 `json:"total"`
	Errors uint64 `json:"errors"`
}

type breakerSettingsDoc struct {
	OpenAfterConsecutiveFailures int    `json:"openAfterConsecutiveFailures"`
	OpenFor                      string `json:"openFor"`
}

// loadFailureDoc is a group whose backend keeps failing to load. Its error
// text, which can name internal hosts, is only in the reconcile log.
type loadFailureDoc struct {
	Group string `json:"group"`
	// Key is the backend key that fails to load.
	Key string `json:"key"`
	// Failures counts its consecutive failed loads, since Since.
	Failures int       `json:"failures"`
	Since    time.Time `json:"since"`
	// RetryAt is when reconcile may load it again.
	RetryAt time.Time `json:"retryAt"`
	// Serving is whether an earlier backend still serves the group.
	Serving bool `json:"serving"`
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
	// provided by the backend when it loaded (a DiscoveryProvider, never
	// fetched per request), cached (fetched, and fresh for
	// discoveryCacheTTL), expired (refetched on the next /apis request),
	// or not cached (fetched on the next aggregated /apis request).
	Discovery     string   `json:"discovery"`
	OpenAPICached []string `json:"openapiCached,omitempty"`
	Watches       int64    `json:"watches"`
}

// breakerStatusDoc reports a group's breaker. Its counts start when the
// group's backend was loaded, and reset when the breaker changes state.
type breakerStatusDoc struct {
	// Scope is what the breaker counts: proxied requests, the plugin's client
	// calls, or nothing here: per-destination when the single-tenant fallback
	// keeps a breaker per destination instead, and none when the group has no
	// breaker, as the embedded API server's groups don't.
	Scope               string `json:"scope"`
	State               string `json:"state,omitempty"`
	Requests            uint32 `json:"requests"`
	Successes           uint32 `json:"successes"`
	Failures            uint32 `json:"failures"`
	ConsecutiveFailures uint32 `json:"consecutiveFailures"`
	// FailuresUntilOpen is how many more consecutive failures open a closed
	// breaker.
	FailuresUntilOpen uint32 `json:"failuresUntilOpen,omitempty"`
	// RetryAt is when an open breaker lets the next request through as a
	// trial. The breaker stays open until that request arrives, so a time in
	// the past means the next request is the trial.
	RetryAt *time.Time `json:"retryAt,omitempty"`
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
		Ready: r.Ready(req.Context()) == nil,
		Reconciler: reconcilerDoc{
			Phase:  phaseNames[starting],
			Total:  r.reconciles.Load(),
			Errors: r.reconcileErrors.Load(),
		},
		Breakers: breakerSettingsDoc{OpenAfterConsecutiveFailures: breakerOpenAfter, OpenFor: breakerOpenFor.String()},
		Groups:   []groupStatusDoc{},
	}
	if s := r.state.Load(); s != nil {
		doc.Reconciler.Phase = phaseNames[s.phase]
		doc.Reconciler.LastFailed = s.err != nil
	}
	if ns := r.lastReconcile.Load(); ns != 0 {
		t := time.Unix(0, ns).UTC()
		doc.Reconciler.Last = &t
	}
	if status, ok := r.loader.(loaderStatus); ok {
		doc.Sources = status.sourceStatuses()
		doc.Shadowed = status.shadowedGroups()
		for _, counter := range status.counters() {
			if counter.Status == "" {
				continue
			}
			if doc.Counters == nil {
				doc.Counters = map[string]map[string]uint64{}
			}
			doc.Counters[counter.Status] = counter.ByResult
		}
	}

	for name, entry := range *r.snapshot.Load() {
		doc.Groups = append(doc.Groups, r.groupStatus(name, entry))
	}
	if failures := r.loadFailureDocs.Load(); failures != nil {
		doc.LoadFailures = *failures
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
	b.Scope = entry.breakerScope.String()
	if !entry.breakerScope.counted() {
		return "unknown", b
	}
	state, counts := entry.breakerState(), entry.breaker.Counts()
	b.State = state.String()
	b.Requests, b.Successes, b.Failures = counts.Requests, counts.TotalSuccesses, counts.TotalFailures
	b.ConsecutiveFailures = counts.ConsecutiveFailures

	switch state {
	case gobreaker.StateOpen:
		if entry.breakerView != nil {
			if retryAt, ok := entry.breakerView.RetryAt(); ok {
				b.RetryAt = &retryAt
			}
		}
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

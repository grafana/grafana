package router

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/sony/gobreaker/v2"
)

const (
	apisPrefix      = "/apis"
	openapiV3Prefix = "/openapi/v3"
)

// handlerEntry is the router's persistent, reconcile-only record for one group:
// the live Backend (kept so discovery synthesis reflects whatever is actually
// being served — see publish — even when a later reload fails and the old
// handler stays live), the built handler, and lastRV, the RouteConfig
// fingerprint last applied. lastRV lets reconcile skip rebuilding a group
// whose config has not changed. Touched only by reconcile (single goroutine),
// so it needs no lock.
type handlerEntry struct {
	backend Backend
	handler http.Handler
	lastRV  string

	// breaker is a passive, per-group circuit breaker: it observes real
	// proxied request outcomes (transport errors, 502/503/504) rather than
	// running any active probe of its own -- see AGENTS.md "Passive circuit
	// breaking". Reset to a fresh instance whenever this group is rebuilt for
	// a changed RV (the target may have moved), but left untouched across an
	// unchanged-RV reconcile, same as backend/handler above.
	breaker *gobreaker.CircuitBreaker[struct{}]
}

// servingEntry is the immutable per-group record published into snapshot: the
// proxy handler plus the RV. RV is needed at serve time to validate/label the
// per-group-version openapi cache; served (reconcile-goroutine-owned) isn't
// safe to read from serving goroutines, so RV is duplicated here.
type servingEntry struct {
	handler http.Handler
	rv      string
	breaker *gobreaker.CircuitBreaker[struct{}]
}

type phase int

const (
	starting phase = iota // Run launched, first reconcile not done
	serving               // first reconcile done, loop running
	stopped               // clean exit (Run ctx cancelled)
	crashed               // loop exited/panicked unexpectedly
)

type routerState struct {
	phase phase
	err   error // last reconcile error while serving, or the panic on crash

	// served is true if r.served was non-empty at the moment this state was
	// recorded -- i.e. at least one group has ever loaded successfully, so
	// there is real last-known-good to serve even if err is set. Computed in
	// storeServing (which runs on the reconcile goroutine, the sole owner of
	// r.served) and stored here so Ready can read it lock-free from any
	// goroutine without touching r.served directly.
	served bool
}

// there won't be a cloud apps router in enterprise
// can be in OSS right now, RoutesLoader stays in enterprise in cloud
type GrafanaRouter struct {
	state atomic.Pointer[routerState]

	loader RoutesLoader

	// served is the desired-state map, keyed by group: the groups actually
	// installed into the last reconcile's snapshot. Owned by reconcile (single
	// goroutine); never read from the serving path.
	served map[string]*handlerEntry

	// snapshot is the immutable group -> servingEntry map used to serve
	// requests. reconcile rebuilds and atomically stores it; serving loads it.
	snapshot atomic.Pointer[map[string]servingEntry]

	// apiGroupList and openapiIndex are the router-synthesized root documents
	// for /apis and /openapi/v3, rebuilt from served's Backend.Manifest() on
	// every reconcile and stored atomically alongside snapshot — never from the
	// raw Load() result, so a group that failed to (re)load or a duplicate in a
	// single Load never gets advertised inconsistently with what's actually
	// served. Never a cross-group OpenAPI schema merge — see AGENTS.md / the
	// design spec.
	apiGroupList atomic.Pointer[cachedDoc]
	openapiIndex atomic.Pointer[cachedDoc]

	// openapiDocs caches per-group-version OpenAPI v3 documents fetched from
	// the owning backend, keyed by "group/version". Written by many
	// concurrent serving goroutines on cache-miss (unlike snapshot/
	// apiGroupList/openapiIndex, which have exactly one writer, reconcile),
	// so it's a sync.Map rather than an atomic.Pointer swap. A stale rv is
	// simply overwritten on next fetch, not actively evicted.
	openapiDocs sync.Map
}

func NewGrafanaRouter(loader RoutesLoader) *GrafanaRouter {
	r := &GrafanaRouter{
		loader: loader,
		served: map[string]*handlerEntry{},
	}
	empty := map[string]servingEntry{}
	r.snapshot.Store(&empty)
	emptyGroups := buildAPIGroupList(nil)
	r.apiGroupList.Store(&emptyGroups)
	emptyIndex := buildOpenAPIV3Index(nil)
	r.openapiIndex.Store(&emptyIndex)
	return r
}

// HandleFunc is the single serving entry point: it serves both the reverse-proxy
// tree (/apis, by group) and the OpenAPI v3 discovery/documents (/openapi/v3),
// and falls through to next for anything the router does not own. There is no
// separate exported OpenAPI handler — a caller wraps this as
// http.HandlerFunc(func(w, r) { router.HandleFunc(w, r, next) }).
func (cr *GrafanaRouter) HandleFunc(w http.ResponseWriter, req *http.Request, next http.Handler) {
	path := req.URL.Path

	// Merged OpenAPI v3 document, served router-side.
	if path == openapiV3Prefix || strings.HasPrefix(path, openapiV3Prefix+"/") {
		cr.serveOpenAPIV3(w, req, next)
		return
	}

	// Not part of the /apis tree — not ours.
	if path != apisPrefix && !strings.HasPrefix(path, apisPrefix+"/") {
		next.ServeHTTP(w, req)
		return
	}

	// Root discovery (APIGroupList) is the only path that needs a union
	// across every group; synthesize it router-side.
	if path == apisPrefix || path == apisPrefix+"/" {
		cr.serveAPIGroupList(w, req)
		return
	}

	group := groupFromPath(path)
	handlers := *cr.snapshot.Load()
	entry, ok := handlers[group]
	if !ok {
		// A group we don't serve. Fall through rather than 404 so a caller
		// mounted ahead of us keeps its own routes.
		next.ServeHTTP(w, req)
		return
	}
	// /apis/<group> group discovery and /apis/<group>/... both proxy to the
	// single owning backend (one backend owns all versions of a group).
	serveThroughBreaker(entry.breaker, entry.handler, w, req)
}

// groupFromPath returns the group segment of an /apis/<group>[/...] path.
// The caller guarantees the /apis/ prefix and a non-root path.
func groupFromPath(path string) string {
	rest := strings.TrimPrefix(path, apisPrefix+"/")
	if i := strings.IndexByte(rest, '/'); i >= 0 {
		rest = rest[:i]
	}
	return rest
}

// serveAPIGroupList synthesizes the /apis root (APIGroupList) from the current
// group snapshot.
func (cr *GrafanaRouter) serveAPIGroupList(w http.ResponseWriter, req *http.Request) {
	serveCachedDoc(w, req, cr.apiGroupList.Load())
}

// serveCachedDoc writes a synthesized document, honoring conditional GET via
// If-None-Match against the document's RV-derived ETag. Shared by
// serveAPIGroupList and the /openapi/v3 root doc.
func serveCachedDoc(w http.ResponseWriter, req *http.Request, doc *cachedDoc) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("ETag", doc.etag)
	if req.Header.Get("If-None-Match") == doc.etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(doc.body)
}

// serveOpenAPIV3 serves the merged OpenAPI v3 document. Reached only via
// HandleFunc; not exported, so /openapi/v3 always flows through the one serving
// entry point.
func (cr *GrafanaRouter) serveOpenAPIV3(w http.ResponseWriter, req *http.Request, next http.Handler) {
	if req.URL.Path == openapiV3Prefix {
		serveCachedDoc(w, req, cr.openapiIndex.Load())
		return
	}
	group, version, ok := parseOpenAPIGroupVersionPath(req.URL.Path)
	if !ok {
		next.ServeHTTP(w, req)
		return
	}
	cr.serveOpenAPIGroupVersion(w, req, next, group, version)
}

// serveOpenAPIGroupVersion serves one group's OpenAPI v3 document: a
// conditional-GET-aware, RV-keyed cache in front of a plain proxy to the
// owning backend. Never merges across groups — this is one backend's
// document, verbatim.
func (cr *GrafanaRouter) serveOpenAPIGroupVersion(w http.ResponseWriter, req *http.Request, next http.Handler, group, version string) {
	handlers := *cr.snapshot.Load()
	entry, ok := handlers[group]
	if !ok {
		next.ServeHTTP(w, req)
		return
	}

	etag := quoteETag(entry.rv)
	if req.Header.Get("If-None-Match") == etag {
		w.Header().Set("ETag", etag)
		w.WriteHeader(http.StatusNotModified)
		return
	}

	cacheKey := group + "/" + version
	if cached, ok := cr.openapiDocs.Load(cacheKey); ok {
		c := cached.(openapiCacheEntry)
		if c.rv == entry.rv {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("ETag", c.etag)
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(c.body)
			return
		}
	}

	// Cache miss or stale rv: proxy through, capturing the response so it can
	// be cached on success. Strip conditional headers first — see
	// stripConditionalHeaders' doc comment for why. Gated by the same
	// per-group breaker as the main dispatch — this is still a real proxy
	// call to the backend, so an outage must fail fast here too.
	proxyReq := req.Clone(req.Context())
	stripConditionalHeaders(proxyReq)
	rec := newCaptureWriter()
	_, err := entry.breaker.Execute(func() (struct{}, error) {
		entry.handler.ServeHTTP(rec, proxyReq)
		return struct{}{}, breakerOutcome(proxyReq, rec.statusCode)
	})
	if errors.Is(err, gobreaker.ErrOpenState) || errors.Is(err, gobreaker.ErrTooManyRequests) {
		http.Error(w, "backend unavailable", http.StatusServiceUnavailable)
		return
	}

	for k, v := range rec.header {
		w.Header()[k] = v
	}
	if rec.statusCode == http.StatusOK {
		cr.openapiDocs.Store(cacheKey, openapiCacheEntry{rv: entry.rv, etag: etag, body: rec.body.Bytes()})
		w.Header().Set("ETag", etag)
	}
	w.WriteHeader(rec.statusCode)
	_, _ = w.Write(rec.body.Bytes())
}

// parseOpenAPIGroupVersionPath extracts group and version from a path of the
// exact shape "/openapi/v3/apis/<group>/<version>". ok is false for the root
// "/openapi/v3" doc itself, a trailing slash, a missing version, extra
// segments, or the k8s "api/<version>" core-group shape (not applicable here
// — this router has no core group).
func parseOpenAPIGroupVersionPath(path string) (group, version string, ok bool) {
	rest, hasPrefix := strings.CutPrefix(path, openapiV3Prefix+"/")
	if !hasPrefix || rest == "" {
		return "", "", false
	}
	rest, hasAPIs := strings.CutPrefix(rest, "apis/")
	if !hasAPIs || rest == "" {
		return "", "", false
	}
	parts := strings.Split(rest, "/")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", "", false
	}
	return parts[0], parts[1], true
}

// Run does an initial load, then reconciles on every coalesced wake from the
// loader until ctx is cancelled.
func (r *GrafanaRouter) Run(ctx context.Context) error {
	r.state.Store(&routerState{phase: starting})
	dirty, err := r.loader.Notify(ctx)
	if err != nil {
		return fmt.Errorf("router: notify: %w", err)
	}

	go func() {
		defer func() {
			if p := recover(); p != nil {
				r.state.Store(&routerState{phase: crashed, err: fmt.Errorf("panic: %v", p)})
			}
		}()

		r.storeServing(r.reconcile(ctx))

		for {
			select {
			case <-ctx.Done():
				r.state.Store(&routerState{phase: stopped})
				return
			case _, ok := <-dirty:
				if !ok {
					// Notify's channel closed: it will never signal again. A
					// closed channel is always immediately ready, so leaving
					// this case armed would busy-loop reconcile forever. Park
					// it by nilling the local var -- a nil channel blocks
					// forever, so this case is never selected again and only
					// ctx.Done() can still fire.
					dirty = nil
					continue
				}
				r.storeServing(r.reconcile(ctx))
			}
		}
	}()
	return nil
}

// storeServing records a completed reconcile's outcome. A non-nil err (a
// partial Backend.Load failure -- see reconcile's doc comment) does not stop
// the router serving last-known-good as long as at least one group is
// actually served, so it's logged here rather than unconditionally surfaced
// as a readiness failure -- see Ready's doc comment for why.
func (r *GrafanaRouter) storeServing(err error) {
	if err != nil {
		slog.Error("router: reconcile completed with errors, serving last-known-good", "err", err)
	}
	r.state.Store(&routerState{phase: serving, err: err, served: len(r.served) > 0})
}

// Ready reports the router is initialized and serving. The snapshot is
// populated on the first reconcile in Run.
//
// A non-nil s.err while serving means the last reconcile had some failure
// (e.g. one group's Backend.Load errored, or loader.Load itself failed).
// Whether that should fail readiness depends on s.served: if at least one
// group is currently served, that's real last-known-good -- reconcile
// deliberately keeps serving every other group in that case (see its doc
// comment), so failing readiness here would drain the whole router over one
// misbehaving group while it's still able to proxy everything else. But if
// nothing has ever been served (e.g. the very first reconcile's loader.Load
// call failed outright, or every backend failed to load), there is no
// last-known-good to fall back on -- the router owns /apis and /openapi/v3,
// so reporting ready with an empty snapshot would send clients an empty
// discovery document instead of waiting for a real load. The enterprise
// command wires this to /readyz. The error is still worth surfacing (see
// storeServing's slog.Error) even when it doesn't fail readiness.
func (r *GrafanaRouter) Ready(context.Context) error {
	s := r.state.Load()
	switch {
	case s == nil || s.phase == starting:
		return fmt.Errorf("router: initial reconcile not complete")
	case s.phase == serving && s.err != nil && !s.served:
		return fmt.Errorf("router: nothing served yet: %w", s.err)
	case s.phase == serving:
		return nil
	default: // stopped / crashed
		return fmt.Errorf("router: not serving (phase %d)", s.phase)
	}
}

// Alive reports the router is not in a non-recoverable state. Only a crashed
// reconcile loop (unexpected exit or panic) is unrecoverable; a restart fixes
// it. starting/serving/stopped are all expected or transient.
func (r *GrafanaRouter) Alive(context.Context) error {
	if s := r.state.Load(); s != nil && s.phase == crashed {
		return fmt.Errorf("router: reconcile loop crashed: %w", s.err)
	}
	return nil
}

// reconcile re-reads the full desired route set and converges served to it:
// rebuild changed/new groups, leave unchanged ones (RV match) untouched, drop
// groups that disappeared, then publish a fresh snapshot. Level-triggered, so
// it is safe to run on any wake.
func (r *GrafanaRouter) reconcile(ctx context.Context) error {
	rawBackends, err := r.loader.Load(ctx)
	if err != nil {
		// Keep serving last-known-good; a later wake retries.
		return fmt.Errorf("router: load failed, keeping current routes: %w", err)
	}

	var errs []error
	seen := make(map[string]struct{}, len(rawBackends))
	for _, b := range rawBackends {
		group := b.Group()
		if _, dup := seen[group]; dup {
			// One backend owns all versions of a group; a duplicate group in a
			// single load is a config error. Last-wins, warn — do not crash the
			// router on bad GitOps config. r.served is keyed by group, so the
			// later duplicate simply overwrites the earlier one here too —
			// discovery (sourced from r.served in publish) never sees both.
			slog.Warn("router: duplicate group in route set, overwriting", "group", group)
		}
		seen[group] = struct{}{}

		e, ok := r.served[group]
		if ok && e.lastRV == b.RV() {
			continue // unchanged: keep the live Backend (and its pool)
		}

		handler, err := b.Load(ctx)
		if err != nil {
			// Load failed: keep last-known-good for this group (leave the
			// existing entry, if any, untouched) and don't publish a nil
			// handler. lastRV is not advanced, so a later wake retries. Because
			// the old entry (old backend, old manifest) is left untouched,
			// publish's discovery synthesis stays consistent with what's
			// actually being served, not with this failed reload's manifest.
			errs = append(errs, fmt.Errorf("router: backend load failed for group %q, keeping current route: %w", group, err))
			continue
		}

		if !ok {
			// New group: create the entry, starting with a fresh, closed breaker.
			r.served[group] = &handlerEntry{backend: b, handler: handler, lastRV: b.RV(), breaker: newGroupBreaker(group)}
			continue
		}
		// Changed: swap the backend/handler in place. The transport (and its
		// pool) is reused from the shared cache when the TLS key is unchanged,
		// so the pool survives. The breaker is reset to a fresh instance,
		// though: an RV change can mean the target itself moved, so any prior
		// trip state would be stale -- see AGENTS.md "Passive circuit
		// breaking".
		e.backend = b
		e.handler = handler
		e.lastRV = b.RV()
		e.breaker = newGroupBreaker(group)
	}

	for group := range r.served {
		if _, ok := seen[group]; !ok {
			delete(r.served, group)
		}
	}

	r.publish()
	return errors.Join(errs...)
}

// publish builds fresh immutable artifacts from r.served and stores them
// atomically for the serving path: the per-group handler snapshot, the
// synthesized APIGroupList, and the synthesized OpenAPI v3 discovery index.
// Deliberately sourced from r.served (what reconcile actually installed), not
// the raw Load() result — a group whose reload failed or a duplicate group in
// a single Load must not be advertised in discovery when it isn't (or isn't
// consistently) being served.
func (r *GrafanaRouter) publish() {
	snap := make(map[string]servingEntry, len(r.served))
	backends := make([]Backend, 0, len(r.served))
	for group, e := range r.served {
		snap[group] = servingEntry{handler: e.handler, rv: e.lastRV, breaker: e.breaker}
		if e.backend != nil {
			backends = append(backends, e.backend)
		}
	}
	r.snapshot.Store(&snap)

	groupList := buildAPIGroupList(backends)
	r.apiGroupList.Store(&groupList)

	index := buildOpenAPIV3Index(backends)
	r.openapiIndex.Store(&index)
}

// rejectBackendRedirects is a ReverseProxy ModifyResponse hook: a redirect
// from the backend must never reach the client verbatim (an attacker-
// influenced backend could redirect a caller anywhere), so it must become a
// 502 instead. Returning a non-nil error is what does that — ReverseProxy
// closes resp.Body itself and calls its ErrorHandler (whose default writes
// 502) rather than copying the response through; returning nil here would
// forward the 3xx/Location as-is.
func rejectBackendRedirects(resp *http.Response) error {
	if resp.StatusCode >= 300 && resp.StatusCode <= 399 && resp.Header.Get("Location") != "" {
		return fmt.Errorf("router: rejecting redirect from backend (status %d, location %q)", resp.StatusCode, resp.Header.Get("Location"))
	}
	return nil
}

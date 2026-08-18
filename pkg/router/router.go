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
)

const (
	apisPrefix      = "/apis"
	openapiV3Prefix = "/openapi/v3"
)

// handlerEntry is the router's persistent, reconcile-only record for one group:
// the live Backend plus lastRV, the RouteConfig fingerprint last applied. lastRV
// lets reconcile skip rebuilding a group whose config has not changed. Touched
// only by reconcile (single goroutine), so it needs no lock.
type handlerEntry struct {
	handler http.Handler
	lastRV  string
}

// servingEntry is the immutable per-group record published into snapshot: the
// proxy handler plus the RV. RV is needed at serve time to validate/label the
// per-group-version openapi cache; entries (reconcile-goroutine-owned) isn't
// safe to read from serving goroutines, so RV is duplicated here.
type servingEntry struct {
	handler http.Handler
	rv      string
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
}

// there won't be a cloud apps router in enterprise
// can be in OSS right now, RoutesLoader stays in enterprise in cloud
type GrafanaRouter struct {
	state atomic.Pointer[routerState]

	loader RoutesLoader

	// entries is the desired-state map, keyed by group. Owned by reconcile
	// (single goroutine); never read from the serving path.
	entries map[string]*handlerEntry

	// snapshot is the immutable group -> servingEntry map used to serve
	// requests. reconcile rebuilds and atomically stores it; serving loads it.
	snapshot atomic.Pointer[map[string]servingEntry]

	// apiGroupList and openapiIndex are the router-synthesized root documents
	// for /apis and /openapi/v3, rebuilt from backends' Manifest() on every
	// reconcile and stored atomically alongside snapshot. Never a
	// cross-group OpenAPI schema merge — see AGENTS.md / the design spec.
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
		loader:  loader,
		entries: map[string]*handlerEntry{},
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
//
// NOTE: /apis still needs serverAddressByClientCIDRs support to allow local
// in-network clients to connect directly as desired.
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
	entry.handler.ServeHTTP(w, req)
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
	// stripConditionalHeaders' doc comment for why.
	proxyReq := req.Clone(req.Context())
	stripConditionalHeaders(proxyReq)
	rec := newCaptureWriter()
	entry.handler.ServeHTTP(rec, proxyReq)

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

		lastErr := r.reconcile(ctx)
		r.state.Store(&routerState{phase: serving, err: lastErr})

		for {
			select {
			case <-ctx.Done():
				r.state.Store(&routerState{phase: stopped})
				return
			case <-dirty:
				r.state.Store(&routerState{phase: serving, err: r.reconcile(ctx)})
			}
		}
	}()
	return nil
}

// Ready reports the router is initialized and serving. The snapshot is
// populated on the first reconcile in Run.
func (r *GrafanaRouter) Ready(context.Context) error {
	s := r.state.Load()
	switch {
	case s == nil || s.phase == starting:
		return fmt.Errorf("router: initial reconcile not complete")
	case s.phase == serving && s.err != nil:
		return fmt.Errorf("router: last reconcile failed: %w", s.err)
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

// reconcile re-reads the full desired route set and converges entries to it:
// rebuild changed/new groups, leave unchanged ones (RV match) untouched, drop
// groups that disappeared, then publish a fresh snapshot. Level-triggered, so
// it is safe to run on any wake.
func (r *GrafanaRouter) reconcile(ctx context.Context) error {
	backends, err := r.loader.Load(ctx)
	if err != nil {
		// Keep serving last-known-good; a later wake retries.
		return fmt.Errorf("router: load failed, keeping current routes: %w", err)
	}

	var errs []error
	seen := make(map[string]struct{}, len(backends))
	for _, b := range backends {
		group := b.Group()
		if _, dup := seen[group]; dup {
			// One backend owns all versions of a group; a duplicate group in a
			// single load is a config error. Last-wins, warn — do not crash the
			// router on bad GitOps config.
			slog.Warn("router: duplicate group in route set, overwriting", "group", group)
		}
		seen[group] = struct{}{}

		e, ok := r.entries[group]
		if ok && e.lastRV == b.RV() {
			continue // unchanged: keep the live Backend (and its pool)
		}

		handler, err := b.Load(ctx)
		if err != nil {
			// Load failed: keep last-known-good for this group (leave the
			// existing entry, if any, untouched) and don't publish a nil
			// handler. lastRV is not advanced, so a later wake retries.
			errs = append(errs, fmt.Errorf("router: backend load failed for group %q, keeping current route: %w", group, err))
			continue
		}

		if !ok {
			// New group: create the entry.
			r.entries[group] = &handlerEntry{handler: handler, lastRV: b.RV()}
			continue
		}
		// Changed: swap the handler in place. The transport (and its pool) is
		// reused from the shared cache when the TLS key is unchanged, so the
		// pool survives.
		e.handler = handler
		e.lastRV = b.RV()
	}

	for group := range r.entries {
		if _, ok := seen[group]; !ok {
			delete(r.entries, group)
		}
	}

	r.publish(backends)
	return errors.Join(errs...)
}

// publish builds fresh immutable artifacts from entries/backends and stores
// them atomically for the serving path: the per-group handler snapshot, the
// synthesized APIGroupList, and the synthesized OpenAPI v3 discovery index.
func (r *GrafanaRouter) publish(backends []Backend) {
	snap := make(map[string]servingEntry, len(r.entries))
	for group, e := range r.entries {
		snap[group] = servingEntry{handler: e.handler, rv: e.lastRV}
	}
	r.snapshot.Store(&snap)

	groupList := buildAPIGroupList(backends)
	r.apiGroupList.Store(&groupList)

	index := buildOpenAPIV3Index(backends)
	r.openapiIndex.Store(&index)
}

func rejectBackendRedirects(resp *http.Response) error {
	if resp.StatusCode >= 300 && resp.StatusCode <= 399 && resp.Header.Get("Location") != "" {
		resp.Body.Close()
		// replace with 502 — don't forward the redirect
	}
	return nil
}

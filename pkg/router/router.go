package router

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/sony/gobreaker/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	apisPrefix      = "/apis"
	openapiV3Prefix = "/openapi/v3"
)

// handlerEntry is reconcile's record for one served group. backend is the one
// actually serving (not the latest Load result), so discovery stays consistent
// when a reload fails. lastKey lets reconcile skip unchanged groups. Owned by
// the reconcile goroutine, so it needs no lock.
type handlerEntry struct {
	backend Backend
	handler http.Handler
	lastKey string

	// breaker is replaced when the key changes, since the target may have
	// moved and its old trip state no longer applies.
	breaker *gobreaker.CircuitBreaker[struct{}]
}

// servingEntry is the immutable per-group record published into snapshot. It
// copies what the serving path needs from handlerEntry, which only the
// reconcile goroutine may read.
type servingEntry struct {
	group   metav1.APIGroup
	handler http.Handler
	key     string
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

	// served records whether any group was being served when this state was
	// stored, so Ready can read it without touching r.served.
	served bool
}

// GrafanaRouter reconciles the routes from a RoutesLoader and serves them by
// API group.
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

	// apiGroupList and openapiIndex are the synthesized /apis and /openapi/v3
	// root documents, rebuilt from served (not the raw Load result) on every
	// reconcile so discovery only advertises what is actually served.
	apiGroupList atomic.Pointer[cachedDoc]
	openapiIndex atomic.Pointer[cachedDoc]

	// openapiDocs caches per-group-version OpenAPI v3 documents, keyed by
	// "group/version". Serving goroutines write it on cache misses, so it is a
	// sync.Map rather than an atomic swap. Stale entries are overwritten on the
	// next fetch, not evicted.
	openapiDocs sync.Map

	// Set before serving by the standalone target; middleware keeps its delegate.
	unregisteredGroupHandler http.Handler
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

// HandleFunc is the single serving entry point for /apis and /openapi/v3.
// Anything the router does not own falls through to next.
func (r *GrafanaRouter) HandleFunc(w http.ResponseWriter, req *http.Request, next http.Handler) {
	path := req.URL.Path

	// OpenAPI v3 discovery index and per-group-version documents.
	if path == openapiV3Prefix || strings.HasPrefix(path, openapiV3Prefix+"/") {
		r.serveOpenAPIV3(w, req, next)
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
		r.serveAPIGroupList(w, req, next)
		return
	}

	group := groupFromPath(path)
	handlers := *r.snapshot.Load()
	entry, ok := handlers[group]
	if !ok {
		r.serveUnregisteredGroup(w, req, next, group)
		return
	}
	// /apis/<group> group discovery and /apis/<group>/... both proxy to the
	// single owning backend (one backend owns all versions of a group).
	serveThroughBreaker(entry.breaker, group, entry.handler, w, req)
}

func (r *GrafanaRouter) serveUnregisteredGroup(w http.ResponseWriter, req *http.Request, next http.Handler, group string) {
	if group != "" && r.unregisteredGroupHandler != nil {
		r.unregisteredGroupHandler.ServeHTTP(w, req)
		return
	}
	next.ServeHTTP(w, req)
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

// GroupFromPath returns the group of an /apis/<group>[/...] path, or "" for
// any other path, including the /apis root.
func GroupFromPath(path string) string {
	if path == apisPrefix || path == apisPrefix+"/" || (path != apisPrefix && !strings.HasPrefix(path, apisPrefix+"/")) {
		return ""
	}
	return groupFromPath(path)
}

// KnownGroup reports whether group has a live backend in the current
// snapshot. Check it before using a client-supplied group as a metric label,
// or every unique path segment creates a new series.
func (r *GrafanaRouter) KnownGroup(group string) bool {
	handlers := *r.snapshot.Load()
	_, ok := handlers[group]
	return ok
}

// serveCachedDoc writes a synthesized document, honoring conditional GET via
// If-None-Match against the document's key-derived ETag. Shared by
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

// serveOpenAPIV3 serves the /openapi/v3 index and per-group-version documents.
func (r *GrafanaRouter) serveOpenAPIV3(w http.ResponseWriter, req *http.Request, next http.Handler) {
	if req.URL.Path == openapiV3Prefix || req.URL.Path == openapiV3Prefix+"/" {
		r.serveOpenAPIIndex(w, req, next)
		return
	}
	group, version, ok := parseOpenAPIGroupVersionPath(req.URL.Path)
	if !ok {
		next.ServeHTTP(w, req)
		return
	}
	r.serveOpenAPIGroupVersion(w, req, next, group, version)
}

// serveOpenAPIGroupVersion proxies one group-version's OpenAPI v3 document
// from its owning backend, cached and validated against the backend key.
func (r *GrafanaRouter) serveOpenAPIGroupVersion(w http.ResponseWriter, req *http.Request, next http.Handler, group, version string) {
	handlers := *r.snapshot.Load()
	entry, ok := handlers[group]
	if !ok {
		r.serveUnregisteredGroup(w, req, next, group)
		return
	}

	cacheKey := group + "/" + version
	cacheableRequest := req.Method == http.MethodGet && req.Header.Get("Range") == ""
	if cached, ok := r.openapiDocs.Load(cacheKey); ok && cacheableRequest {
		c := cached.(openapiCacheEntry)
		if c.key == entry.key && c.accept == req.Header.Get("Accept") && c.encoding == req.Header.Get("Accept-Encoding") {
			maps.Copy(w.Header(), c.header.Clone())
			w.Header().Set("ETag", c.etag)
			if req.Header.Get("If-None-Match") == c.etag {
				w.WriteHeader(http.StatusNotModified)
				return
			}
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(c.body)
			return
		}
	}

	// Cache miss or stale key: proxy through the breaker and capture the
	// response so it can be cached.
	proxyReq := req.Clone(req.Context())
	stripConditionalHeaders(proxyReq)
	stripHashQueryParam(proxyReq)
	rec := newCaptureWriter()
	serveThroughBreaker(entry.breaker, group, entry.handler, rec, proxyReq)

	maps.Copy(w.Header(), rec.header)
	// Private schemas pass through authorization on every request. Honor their
	// private/no-cache responses instead of bypassing that check on a cache hit.
	if rec.statusCode == http.StatusOK && cacheableRequest && cacheableOpenAPIResponse(rec.header) {
		etag := quoteETag(hashHex(entry.key + "\x00" + rec.body.String()))
		r.openapiDocs.Store(cacheKey, openapiCacheEntry{
			key: entry.key, etag: etag, body: rec.body.Bytes(), header: openAPICacheHeaders(rec.header),
			accept: req.Header.Get("Accept"), encoding: req.Header.Get("Accept-Encoding"),
		})
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
					// A closed channel is always ready and would busy-loop
					// reconcile; a nil channel is never selected.
					dirty = nil
					continue
				}
				r.storeServing(r.reconcile(ctx))
			}
		}
	}()
	return nil
}

// storeServing records a completed reconcile's outcome. Errors are logged
// here; Ready decides whether they affect readiness.
func (r *GrafanaRouter) storeServing(err error) {
	if err != nil {
		slog.Error("router: reconcile completed with errors, serving last-known-good", "err", err)
	}
	r.state.Store(&routerState{phase: serving, err: err, served: len(r.served) > 0})
}

// Ready reports whether the router can serve traffic. A reconcile error does
// not fail readiness while some group is served: the router keeps serving
// last-known-good, and draining it over one bad group would drop every other
// group too. With nothing ever served it must fail, since the router owns
// /apis and would otherwise return empty discovery.
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
// rebuild changed/new groups, leave unchanged ones (key match) untouched, drop
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
		group := b.Group().Name
		if _, dup := seen[group]; dup {
			// One backend owns all versions of a group. A duplicate is a config
			// error; the last one wins rather than crashing the router.
			slog.Warn("router: duplicate group in route set, overwriting", "group", group)
		}
		seen[group] = struct{}{}

		e, ok := r.served[group]
		if ok && e.lastKey == b.Key() {
			continue // unchanged: keep the live Backend (and its pool)
		}

		handler, err := b.Load(ctx)
		if err != nil {
			// Keep last-known-good for this group. lastKey is not advanced, so
			// a later wake retries.
			errs = append(errs, fmt.Errorf("router: backend load failed for group %q, keeping current route: %w", group, err))
			continue
		}

		if !ok {
			// New group: create the entry, starting with a fresh, closed breaker.
			r.served[group] = &handlerEntry{backend: b, handler: handler, lastKey: b.Key(), breaker: newGroupBreaker(group)}
			continue
		}
		// Changed: swap in place. Connection pools survive through the
		// loader's shared transports; the breaker is reset (see handlerEntry).
		e.backend = b
		e.handler = handler
		e.lastKey = b.Key()
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

// publish atomically stores the serving snapshot and the synthesized root
// discovery documents, all built from r.served.
func (r *GrafanaRouter) publish() {
	snap := make(map[string]servingEntry, len(r.served))
	backends := make([]Backend, 0, len(r.served))
	for group, e := range r.served {
		entry := servingEntry{handler: e.handler, key: e.lastKey, breaker: e.breaker}
		if e.backend != nil {
			entry.group = e.backend.Group()
			backends = append(backends, e.backend)
		}
		snap[group] = entry
	}
	r.snapshot.Store(&snap)

	groupList := buildAPIGroupList(backends)
	r.apiGroupList.Store(&groupList)

	index := buildOpenAPIV3Index(backends)
	r.openapiIndex.Store(&index)
}

// rejectBackendRedirects is a ReverseProxy ModifyResponse hook that turns a
// backend redirect into a 502, so a backend can never redirect a caller
// elsewhere.
func rejectBackendRedirects(resp *http.Response) error {
	if resp.StatusCode >= 300 && resp.StatusCode <= 399 && resp.Header.Get("Location") != "" {
		return fmt.Errorf("router: rejecting redirect from backend (status %d, location %q)", resp.StatusCode, resp.Header.Get("Location"))
	}
	return nil
}

package router

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/sony/gobreaker/v2"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
	semconv "go.opentelemetry.io/otel/semconv/v1.43.0"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/util/errhttp"
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
	// moved and its old trip state no longer applies. breakerView follows its
	// state; read that instead of breaker.State, which can change it.
	breaker     *groupBreaker
	breakerView *breakerView

	// watches scopes the watches served by this handler. reconcile ends it when
	// the handler is replaced or removed, so those watches move to the new one.
	watches    context.Context
	endWatches context.CancelFunc

	// loadedAt and watching are for the status page: when this handler was
	// loaded, and how many watches it is serving.
	loadedAt time.Time
	watching *atomic.Int64
}

func (r *GrafanaRouter) newHandlerEntry(b Backend, handler http.Handler, group string) *handlerEntry {
	watches, endWatches := context.WithCancel(context.Background())
	view := &breakerView{}
	onChange := func(group string, to gobreaker.State) {
		view.record(to)
		if r.onBreakerChange != nil {
			r.onBreakerChange(group, to)
		}
	}
	return &handlerEntry{
		backend: b, handler: handler, lastKey: b.Key(), breaker: newObservedGroupBreaker(group, onChange), breakerView: view,
		watches: watches, endWatches: endWatches,
		loadedAt: time.Now(), watching: &atomic.Int64{},
	}
}

// servingEntry is the immutable per-group record published into snapshot. It
// copies what the serving path needs from handlerEntry, which only the
// reconcile goroutine may read.
type servingEntry struct {
	group       metav1.APIGroup
	handler     http.Handler
	key         string
	breaker     *groupBreaker
	breakerView *breakerView
	watches     context.Context
	source      string

	// discovery is set when the backend is a DiscoveryProvider, so the
	// group's aggregated discovery needs no request.
	discovery *apidiscoveryv2.APIGroupDiscovery

	// For the status page; see handlerEntry. plugin is set when the backend
	// serves a plugin's APIs.
	loadedAt    time.Time
	watching    *atomic.Int64
	plugin      *PluginStatus
	hasManifest bool

	// callerScoped is set when the backend is a CallerScopedDiscovery.
	callerScoped bool

	// restricted is set when the backend is a RestrictedGroup that reports
	// true: only internal callers may reach or discover the group.
	restricted bool
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

	authn authn.TokenAuthenticator

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

	// manifestDocs is the /discovery tree, published from served with the
	// root documents. manifestFingerprint is the group/key set it was built
	// from, and manifestCache each manifest's document by backend key, so
	// unchanged manifests are not converted again. Both are owned by
	// reconcile.
	manifestDocs        atomic.Pointer[manifestDocs]
	manifestFingerprint string
	manifestCache       map[string]*cachedDoc

	// The public variants of the documents above leave out restricted
	// groups, for callers that are not internal. Each points to the same
	// document as its full variant while no served group is restricted.
	publicAPIGroupList atomic.Pointer[cachedDoc]
	publicOpenAPIIndex atomic.Pointer[cachedDoc]
	publicManifestDocs atomic.Pointer[manifestDocs]

	// internalCaller reports whether a request's caller may reach and
	// discover restricted groups. Nil means no caller may. Set before serving
	// by the service, which owns the policy.
	internalCaller func(*http.Request) bool

	// openapiDocs caches per-group-version OpenAPI v3 documents, keyed by
	// "group/version". Serving goroutines write it on cache misses, so it is a
	// sync.Map rather than an atomic swap. publish drops entries for groups
	// that are gone or whose backend changed. openapiDocsMu serializes stores
	// with that pruning, so a fetch that finishes afterwards can't put an old
	// backend's document back; reads don't take it.
	openapiDocs   sync.Map
	openapiDocsMu sync.Mutex

	// discoveryCache holds aggregated discovery fetched from backends that
	// are not DiscoveryProviders, shared across callers.
	discoveryCache discoveryCache

	// Set before serving by the standalone target; middleware keeps its delegate.
	unregisteredGroupHandler http.Handler

	// reconciles and reconcileErrors count completed reconciles, and
	// lastReconcile is when the latest one finished (Unix nanoseconds), for
	// metrics.
	reconciles      atomic.Uint64
	reconcileErrors atomic.Uint64
	lastReconcile   atomic.Int64

	// onBreakerChange and onDiscovery report events to the metrics; nil when
	// the router is not instrumented. Set before Run.
	onBreakerChange func(group string, to gobreaker.State)
	onDiscovery     func(group, result string)

	// watches ends every watch in progress when the router closes them.
	watches    context.Context
	endWatches context.CancelFunc
}

func NewGrafanaRouter(loader RoutesLoader, tokens authn.TokenAuthenticator) *GrafanaRouter {
	r := &GrafanaRouter{
		loader: loader,
		authn:  tokens,
		served: map[string]*handlerEntry{},
	}
	r.watches, r.endWatches = context.WithCancel(context.Background())
	empty := map[string]servingEntry{}
	r.snapshot.Store(&empty)
	r.publishRootDocs(context.Background(), nil)
	return r
}

// HandleFunc is the single serving entry point for /apis and /openapi/v3.
// Anything the router does not own falls through to next.
func (r *GrafanaRouter) HandleFunc(w http.ResponseWriter, req *http.Request, next http.Handler) {
	r.handle(w, req, next, apiGroup(req.URL.Path))
}

// handle is HandleFunc for a request whose group, apiGroup(req.URL.Path), the
// caller has already read, so a request reads it once.
func (r *GrafanaRouter) handle(w http.ResponseWriter, req *http.Request, next http.Handler, group string) {
	path := req.URL.Path
	isOpenAPI := path == openapiV3Prefix || strings.HasPrefix(path, openapiV3Prefix+"/")
	isAPIs := path == apisPrefix || strings.HasPrefix(path, apisPrefix+"/")

	// Not part of the /apis or /openapi/v3 trees — not ours.
	if !isOpenAPI && !isAPIs {
		setRoute(req, routeNext)
		next.ServeHTTP(w, req)
		return
	}
	if !canonicalAPIPath(req.URL) {
		setRoute(req, routeInvalid)
		http.Error(w, "non-canonical API path", http.StatusBadRequest)
		return
	}

	req = r.authenticate(w, req)
	if req == nil {
		return
	}

	// Built by the router, and checked before group dispatch so the tree is
	// never mistaken for a group.
	if isDiscoveryPath(path) {
		r.serveManifestDiscovery(w, req)
		return
	}

	// OpenAPI v3 discovery index and per-group-version documents.
	if isOpenAPI {
		r.serveOpenAPIV3(w, req, next)
		return
	}

	// Root discovery (APIGroupList) is the only path that needs a union
	// across every group; synthesize it router-side.
	if path == apisPrefix || path == apisPrefix+"/" {
		setRoute(req, routeDiscovery)
		r.serveAPIGroupList(w, req, next)
		return
	}

	// An invalid group name gets no group, so it goes to next: no backend
	// can serve it.
	entry, ok := r.servedGroup(req, group)
	if !ok {
		r.serveUnregisteredGroup(w, req, next, group)
		return
	}

	setRoute(req, routeBackend)
	if rejectUpgrade(w, req) {
		return
	}
	// /apis/<group> group discovery and /apis/<group>/... both proxy to the
	// single owning backend (one backend owns all versions of a group).
	serve := func(w http.ResponseWriter, req *http.Request) {
		serveThroughBreaker(entry.breaker, group, entry.handler, w, req)
	}
	if requestVerb(req) == "watch" {
		if entry.watching != nil {
			entry.watching.Add(1)
			defer entry.watching.Add(-1)
		}
		r.serveWatch(w, req, entry.watches, serve)
		return
	}
	serve(w, req)
}

// authenticate trusts Grafana middleware authentication and verifies tokens for standalone requests.
func (r *GrafanaRouter) authenticate(w http.ResponseWriter, req *http.Request) *http.Request {
	info, _ := identity.GetRequester(req.Context())
	if info != nil {
		return req
	}

	ctx, span := otel.Tracer("github.com/grafana/grafana/pkg/router").Start(routerTraceContext(req), "router.authenticate")
	defer span.End()

	var err error
	errorType := "authentication_failure"
	switch token := req.Header.Get("X-Access-Token"); {
	case token == "":
		err = apierrors.NewUnauthorized("missing access token header")
		errorType = "missing_token"
	case r.authn == nil:
		err = apierrors.NewUnauthorized("token authenticator is not configured")
	default:
		if requestAuth, ok := r.authn.(authn.RequestTokenAuthenticator); ok {
			info, err = requestAuth.AuthenticateTokenForRequest(ctx, token, req)
		} else {
			info, err = r.authn.AuthenticateToken(ctx, token)
		}
		if err == nil && info == nil {
			err = apierrors.NewUnauthorized("token has no requester")
		}
		if apierrors.IsUnauthorized(err) {
			errorType = "invalid_token"
		}
	}
	if err != nil {
		setRoute(req, routeUnauthenticated)
		span.SetAttributes(semconv.ErrorTypeKey.String(errorType))
		span.SetStatus(codes.Error, "")
		_ = errhttp.Write(ctx, err, w)
		return nil
	}

	return req.WithContext(identity.WithRequester(req.Context(), info))
}

// servedGroup returns the entry serving group, as req's caller may see it: a
// restricted group the caller may not see is not served, and req is recorded
// as hidden.
func (r *GrafanaRouter) servedGroup(req *http.Request, group string) (servingEntry, bool) {
	entry, ok := (*r.snapshot.Load())[group]
	if ok && r.visibilityFor(req).hides(entry) {
		setRoute(req, routeHidden)
		return servingEntry{}, false
	}
	return entry, ok
}

// isInternal reports whether req's caller may reach and discover restricted
// groups.
func (r *GrafanaRouter) isInternal(req *http.Request) bool {
	return r.internalCaller != nil && r.internalCaller(req)
}

// visibility decides which served groups one request's caller may see. It
// classifies the caller at most once, on the first restricted group it is
// asked about, so no request pays for the policy while no served group is
// restricted.
type visibility struct {
	router *GrafanaRouter
	req    *http.Request
	// restricted records that a restricted group was asked about, so the
	// response depends on the caller.
	restricted bool
	internal   bool
}

func (r *GrafanaRouter) visibilityFor(req *http.Request) *visibility {
	return &visibility{router: r, req: req}
}

// hides reports whether entry's group must look unserved to the caller.
func (v *visibility) hides(entry servingEntry) bool {
	if !entry.restricted {
		return false
	}
	if !v.restricted {
		v.restricted, v.internal = true, v.router.isInternal(v.req)
	}
	return !v.internal
}

// keepPrivate keeps a response that depended on the caller out of shared
// caches. Call it before the response is written.
func (v *visibility) keepPrivate(w http.ResponseWriter) {
	if v.restricted {
		w.Header().Set("Cache-Control", "private")
	}
}

// seesFullVariant reports whether req's caller sees the full variant of a
// published document that differs from its public one. The response then
// depends on the caller, so it is kept out of shared caches.
func (r *GrafanaRouter) seesFullVariant(w http.ResponseWriter, req *http.Request) bool {
	w.Header().Set("Cache-Control", "private")
	return r.isInternal(req)
}

// rootDocFor returns the variant of a published root document that req's
// caller may see. The two are the same document while no served group is
// restricted.
func (r *GrafanaRouter) rootDocFor(w http.ResponseWriter, req *http.Request, full, public *atomic.Pointer[cachedDoc]) *cachedDoc {
	f, p := full.Load(), public.Load()
	if f != p && r.seesFullVariant(w, req) {
		return f
	}
	return p
}

func (r *GrafanaRouter) serveUnregisteredGroup(w http.ResponseWriter, req *http.Request, next http.Handler, group string) {
	if group != "" && r.unregisteredGroupHandler != nil {
		setRoute(req, routeFallback)
		if rejectUpgrade(w, req) {
			return
		}
		if requestVerb(req) == "watch" {
			r.serveWatch(w, req, nil, r.unregisteredGroupHandler.ServeHTTP)
			return
		}
		r.unregisteredGroupHandler.ServeHTTP(w, req)
		return
	}
	setRoute(req, routeNext)
	next.ServeHTTP(w, req)
}

// discoverySource is where root discovery reads the groups the router does
// not serve: the unregistered-group handler when one is set, otherwise next.
// callerScoped reports whether the source answers for the caller, so its
// answer replaces the defaults of caller-scoped backends. next never serves
// those groups, so its answer must not hide them.
func (r *GrafanaRouter) discoverySource(next http.Handler) (source http.Handler, callerScoped bool) {
	if r.unregisteredGroupHandler != nil {
		return r.unregisteredGroupHandler, true
	}
	return next, false
}

// apiGroup returns the group of an /apis/<group>[/...] path, or "" when there
// is none or it is not a valid group name (see utils.IsAPIGroup). Unlike
// utils.APIGroupFromRequest it reads only the first segment: the router
// rejects a non-canonical path before it routes by group.
func apiGroup(path string) string {
	rest, ok := strings.CutPrefix(path, apisPrefix+"/")
	if !ok {
		return ""
	}
	group, _, _ := strings.Cut(rest, "/")
	if !utils.IsAPIGroup(group) {
		return ""
	}
	return group
}

// breakerState is the group breaker's state, read without changing it. Only
// entries built outside newHandlerEntry, in tests, lack a view.
func (e servingEntry) breakerState() gobreaker.State {
	if e.breakerView == nil {
		return e.breaker.State()
	}
	return e.breakerView.State()
}

// owns reports whether the router answers req itself rather than passing it
// to next: root discovery, which it builds, groups it serves, and paths it
// rejects before routing. In
// middleware mode everything else belongs to the embedded API server, which
// has its own metrics.
func (r *GrafanaRouter) owns(req *http.Request, group string) bool {
	path := req.URL.Path
	inTree := path == apisPrefix || strings.HasPrefix(path, apisPrefix+"/") ||
		path == openapiV3Prefix || strings.HasPrefix(path, openapiV3Prefix+"/")
	switch {
	case inTree && !canonicalAPIPath(req.URL):
		return true // HandleFunc rejects it before routing, so it never reaches next

	case isDiscoveryPath(path):
		return true

	case path == apisPrefix || path == apisPrefix+"/" || path == openapiV3Prefix || path == openapiV3Prefix+"/":
		return true
	case strings.HasPrefix(path, apisPrefix+"/"):
		return r.KnownGroup(group)
	}
	if group, _, ok := parseOpenAPIGroupVersionPath(path); ok {
		return group == discoveryGroup || r.KnownGroup(group)
	}
	return false
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
	contentType := doc.contentType
	if contentType == "" {
		contentType = "application/json"
	}
	w.Header().Set("Content-Type", contentType)
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
		setRoute(req, routeDiscovery)
		r.serveOpenAPIIndex(w, req, next)
		return
	}
	group, version, ok := parseOpenAPIGroupVersionPath(req.URL.Path)
	if !ok {
		setRoute(req, routeNext)
		next.ServeHTTP(w, req)
		return
	}
	if group == discoveryGroup {
		serveDiscoveryOpenAPI(w, req, version)
		return
	}
	r.serveOpenAPIGroupVersion(w, req, next, group, version)
}

// serveOpenAPIGroupVersion proxies one group-version's OpenAPI v3 document
// from its owning backend, cached and validated against the backend key.
func (r *GrafanaRouter) serveOpenAPIGroupVersion(w http.ResponseWriter, req *http.Request, next http.Handler, group, version string) {
	entry, ok := r.servedGroup(req, group)
	if !ok {
		r.serveUnregisteredGroup(w, req, next, group)
		return
	}
	setRoute(req, routeBackend)
	if req.Method != http.MethodGet && req.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "OpenAPI documents are read-only", http.StatusMethodNotAllowed)
		return
	}

	cacheKey := group + "/" + version
	// A caller-scoped backend may answer each caller differently, and the
	// cache is shared.
	cacheableRequest := !entry.callerScoped && req.Method == http.MethodGet && req.Header.Get("Range") == ""
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
	// response so it can be cached. Conditional headers are stripped only
	// when this cache may store the response; otherwise the backend answers
	// them, as a caller-scoped backend's own cache does.
	proxyReq := req.Clone(req.Context())
	if cacheableRequest {
		stripConditionalHeaders(proxyReq)
	}
	stripHashQueryParam(proxyReq)
	rec := newCaptureWriter(maxCachedOpenAPIDocBytes, w)
	serveThroughBreaker(entry.breaker, group, entry.handler, rec, proxyReq)
	if rec.overflowed {
		return // too large to cache; already streamed to the client
	}

	maps.Copy(w.Header(), rec.header)
	// Private schemas pass through authorization on every request. Honor their
	// private/no-cache responses instead of bypassing that check on a cache hit.
	if rec.statusCode == http.StatusOK && cacheableRequest && cacheableOpenAPIResponse(rec.header) {
		etag := quoteETag(hashHex(entry.key + "\x00" + rec.body.String()))
		r.storeOpenAPIDoc(group, cacheKey, openapiCacheEntry{
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

		// A failed reconcile is retried with backoff: nothing else guarantees
		// another wake, for example when the loader's first list fails and no
		// event follows. A wake from the loader still reconciles at once.
		retry := newCooldown(0, reconcileRetryMin, reconcileRetryMax)
		retryTimer := time.NewTimer(0)
		retryTimer.Stop()
		defer retryTimer.Stop()
		var retryC <-chan time.Time
		run := func() {
			err := r.reconcile(ctx)
			r.storeServing(ctx, err)
			now := time.Now()
			if err == nil {
				retry.OnSuccess(now)
				retryTimer.Stop()
				retryC = nil
				return
			}
			retry.OnFailure(now)
			retryTimer.Reset(retry.Until(now))
			retryC = retryTimer.C
		}

		run()
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
				run()
			case <-retryC:
				// The retry reads full state, so a wake already queued is covered.
				dirty = drainWake(dirty)
				run()
			}
		}
	}()
	return nil
}

// drainWake consumes a wake already queued on dirty, if any. It returns nil
// once dirty is closed, so the caller stops selecting on it.
func drainWake(dirty <-chan struct{}) <-chan struct{} {
	if dirty == nil {
		return nil
	}
	select {
	case _, ok := <-dirty:
		if !ok {
			return nil
		}
	default:
	}
	return dirty
}

// Backoff for retrying a failed reconcile.
const (
	reconcileRetryMin = time.Second
	reconcileRetryMax = time.Minute
)

// storeServing records a completed reconcile's outcome. Errors are logged
// here; Ready decides whether they affect readiness.
func (r *GrafanaRouter) storeServing(ctx context.Context, err error) {
	r.reconciles.Add(1)
	r.lastReconcile.Store(time.Now().UnixNano())
	if err != nil {
		r.reconcileErrors.Add(1)
		logging.FromContext(ctx).Error("router: reconcile completed with errors, serving last-known-good", "err", err)
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
		// Keep serving last-known-good; Run retries with backoff.
		return fmt.Errorf("router: load failed, keeping current routes: %w", err)
	}

	var errs []error
	var retired []*handlerEntry
	seen := make(map[string]struct{}, len(rawBackends))
	for _, b := range rawBackends {
		group := b.Group().Name
		if group == discoveryGroup {
			// The router serves this group itself, ahead of group dispatch, so
			// a backend for it could never be reached. The remote sources drop
			// it at discovery; this guards loaders that don't.
			logging.FromContext(ctx).Warn("router: skipping backend for the reserved discovery group", "source", b.Source(), "key", b.Key())
			continue
		}
		if !utils.IsAPIGroup(group) {
			// Requests are dispatched by apiGroup, which reads no group from an
			// invalid name, so such a backend could be advertised but never
			// reached. Aggregate discovery, for one, reports whatever groups a
			// target lists.
			logging.FromContext(ctx).Warn("router: skipping backend with an invalid group name", "group", group, "source", b.Source(), "key", b.Key())
			continue
		}
		if _, dup := seen[group]; dup {
			// One backend owns all versions of a group. A duplicate is a config
			// error; the last one wins rather than crashing the router.
			logging.FromContext(ctx).Warn("router: duplicate group in route set, overwriting", "group", group)
		}
		seen[group] = struct{}{}

		e, ok := r.served[group]
		if ok && e.lastKey == b.Key() {
			continue // unchanged: keep the live Backend (and its pool)
		}

		handler, err := loadBackend(ctx, b)
		if err != nil {
			// Keep last-known-good for this group. lastKey is not advanced, so
			// Run's retry loads it again.
			errs = append(errs, fmt.Errorf("router: backend load failed for group %q, keeping current route: %w", group, err))
			continue
		}

		if !ok {
			// New group: create the entry, starting with a fresh, closed breaker.
			r.served[group] = r.newHandlerEntry(b, handler, group)
			continue
		}
		// Changed: replace the entry. Connection pools survive because each
		// source owns its transports and connections, not the backend; the
		// breaker is reset (see handlerEntry).
		retired = append(retired, e)
		r.served[group] = r.newHandlerEntry(b, handler, group)
	}

	for group, e := range r.served {
		if _, ok := seen[group]; !ok {
			retired = append(retired, e)
			delete(r.served, group)
		}
	}

	r.publish(ctx)
	// End retired watches only after publishing, so clients that re-watch
	// reach the new backend.
	for _, e := range retired {
		if e.endWatches != nil {
			e.endWatches()
		}
	}
	return errors.Join(errs...)
}

// loadBackend turns a panic in one backend's Load into that group's error, so
// a bad backend (such as a plugin with an invalid manifest) cannot stop the
// reconcile loop for every other group.
func loadBackend(ctx context.Context, b Backend) (handler http.Handler, err error) {
	defer func() {
		if p := recover(); p != nil {
			handler, err = nil, fmt.Errorf("panic: %v", p)
		}
	}()
	return b.Load(ctx)
}

// publish atomically stores the serving snapshot and the synthesized root
// discovery documents, all built from r.served.
func (r *GrafanaRouter) publish(ctx context.Context) {
	snap := make(map[string]servingEntry, len(r.served))
	backends := make([]Backend, 0, len(r.served))
	for group, e := range r.served {
		entry := servingEntry{handler: e.handler, key: e.lastKey, breaker: e.breaker, breakerView: e.breakerView, watches: e.watches, loadedAt: e.loadedAt, watching: e.watching}
		if e.backend != nil {
			entry.group = e.backend.Group()
			entry.source = e.backend.Source()
			backends = append(backends, e.backend)
			if provider, ok := e.backend.(DiscoveryProvider); ok {
				if d, ok := provider.Discovery(); ok {
					entry.discovery = &d
				}
			}
			if provider, ok := e.backend.(PluginStatusProvider); ok {
				if plugin, ok := provider.PluginStatus(); ok {
					entry.plugin = &plugin
				}
			}
			_, entry.hasManifest = backendManifest(e.backend)
			_, entry.callerScoped = e.backend.(CallerScopedDiscovery)
			entry.restricted = restrictedBackend(e.backend)
		}
		snap[group] = entry
	}
	r.snapshot.Store(&snap)
	r.discoveryCache.retain(snap)
	r.retainOpenAPIDocs(snap)

	r.publishRootDocs(ctx, backends)
}

// publishRootDocs publishes the root documents and the /discovery tree for
// backends, in a full and a public variant.
func (r *GrafanaRouter) publishRootDocs(ctx context.Context, backends []Backend) {
	public := slices.DeleteFunc(slices.Clone(backends), restrictedBackend)

	groupList := buildAPIGroupList(ctx, backends)
	index := buildOpenAPIV3Index(ctx, backends)
	publicGroupList, publicIndex := &groupList, &index
	if len(public) != len(backends) {
		builtGroupList, builtIndex := buildAPIGroupList(ctx, public), buildOpenAPIV3Index(ctx, public)
		publicGroupList, publicIndex = &builtGroupList, &builtIndex
	}
	r.publicAPIGroupList.Store(publicGroupList)
	r.publicOpenAPIIndex.Store(publicIndex)
	r.apiGroupList.Store(&groupList)
	r.openapiIndex.Store(&index)

	r.publishManifestDocs(ctx, backends)
}

func restrictedBackend(b Backend) bool {
	restricted, ok := b.(RestrictedGroup)
	return ok && restricted.RestrictedGroup()
}

// retainOpenAPIDocs drops cached OpenAPI documents for groups that are no
// longer served, or whose backend changed and would miss the cache anyway.
func (r *GrafanaRouter) retainOpenAPIDocs(snapshot map[string]servingEntry) {
	r.openapiDocsMu.Lock()
	defer r.openapiDocsMu.Unlock()
	r.openapiDocs.Range(func(k, v any) bool {
		group, _, _ := strings.Cut(k.(string), "/")
		if served, ok := snapshot[group]; !ok || served.key != v.(openapiCacheEntry).key {
			r.openapiDocs.Delete(k)
		}
		return true
	})
}

// storeOpenAPIDoc caches a fetched document, unless the group's backend
// changed or went away while it was being fetched.
func (r *GrafanaRouter) storeOpenAPIDoc(group, cacheKey string, doc openapiCacheEntry) {
	r.openapiDocsMu.Lock()
	defer r.openapiDocsMu.Unlock()
	if current, ok := (*r.snapshot.Load())[group]; !ok || current.key != doc.key {
		return
	}
	r.openapiDocs.Store(cacheKey, doc)
}

// rejectBackendRedirects is a ReverseProxy ModifyResponse hook that turns a
// backend redirect into a 502, so a backend can never redirect a caller
// elsewhere.
func rejectBackendRedirects(resp *http.Response) error {
	if resp.StatusCode >= 300 && resp.StatusCode <= 399 && resp.Header.Get("Location") != "" {
		return fmt.Errorf("%w (status %d, location %q)", errBackendRedirect, resp.StatusCode, resp.Header.Get("Location"))
	}
	return nil
}

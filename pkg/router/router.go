package router

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/sony/gobreaker/v2"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaauthz "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

const (
	apisPrefix      = "/apis"
	openapiV3Prefix = "/openapi/v3"
)

// servingEntry is the immutable per-group record published into snapshot. It
// copies what the serving path needs from handlerEntry, which only the
// reconcile goroutine may read.
type servingEntry struct {
	group       metav1.APIGroup
	handler     http.Handler
	key         string
	breaker     *groupBreaker
	breakerView *breakerView
	// breakerScope is what breaker counts; breakerScopeNone without one.
	breakerScope breakerScope
	watches      context.Context
	source       string
	use          *handlerUse

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

	// statusOpenToAdmin lets a requester with the Admin role read the status,
	// not only a Grafana admin: [router] status_open_to_admin, on by default
	// in development.
	statusOpenToAdmin bool

	// served is the desired-state map, keyed by group: the groups actually
	// installed into the last reconcile's snapshot. Owned by reconcile (single
	// goroutine); never read from the serving path.
	served map[string]*handlerEntry

	// loadFailures holds, by group, the backend whose latest load failed, so
	// reconcile retries it only once its own backoff passes. Owned by
	// reconcile.
	loadFailures map[string]*groupLoadFailure
	// loadFailureDocs is the status page's copy of loadFailures, published by
	// reconcile, so a status request never reads reconcile's state.
	loadFailureDocs atomic.Pointer[[]loadFailureDoc]
	// warnings holds the reconcile warnings logged for the routes the loader
	// last returned, so each is logged once while it lasts. Owned by
	// reconcile.
	warnings map[string]struct{}

	// snapshot is the immutable group -> servingEntry map used to serve
	// requests. reconcile rebuilds and atomically stores it; serving loads it.
	snapshot atomic.Pointer[map[string]servingEntry]
	// initialized keeps middleware on the router after the startup handoff,
	// even if readiness later fails. Falling back could serve a different
	// backend for a group the router has taken over.
	initialized atomic.Bool

	// apiGroupList and openapiIndex are the synthesized /apis and /openapi/v3
	// root documents, rebuilt from served (not the raw Load result) on every
	// reconcile so discovery only advertises what is actually served.
	// They are the view of callers that are not access policies; the
	// internal ones are the access policies' view, the same documents when no
	// group is internal. Callers with a namespace filter get documents built
	// per request (rootDocsFor).
	apiGroupList         atomic.Pointer[cachedDoc]
	openapiIndex         atomic.Pointer[cachedDoc]
	internalAPIGroupList atomic.Pointer[cachedDoc]
	internalOpenAPIIndex atomic.Pointer[cachedDoc]

	// internalGroups and namespaceGroups decide which groups each caller
	// sees (SetGroupVisibility). visibilityScoped is set when any caller may
	// see fewer groups than another, and filterNamespaces when the namespace
	// filter is not the default that allows every group. Set before the
	// router serves, and never changed.
	internalGroups   map[string]struct{}
	namespaceGroups  NamespaceGroups
	visibilityScoped bool
	filterNamespaces bool

	// manifestDocs is the /discovery tree, published from served with the
	// root documents. manifestFingerprint is the group/key set it was built
	// from, and manifestCache each manifest's document by backend key, so
	// unchanged manifests are not converted again. Both are owned by
	// reconcile.
	manifestDocs        atomic.Pointer[manifestDocs]
	manifestFingerprint string
	manifestCache       map[string]*cachedDoc
	// builtinManifests are the app manifests compiled into this binary, by
	// group: a fallback, published only for a served group whose backend
	// advertises no manifest of its own (see publishedManifests). Set before
	// the router serves, and never changed.
	builtinManifests map[string]*app.ManifestData

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

	// unregisteredGroupHandler serves groups no backend serves: the
	// single-tenant fallback, set before serving by the standalone target.
	// Root discovery also reads the groups the router doesn't serve from it;
	// it answers for the caller, so its view replaces the defaults of
	// caller-scoped backends. nil otherwise: such groups are not found, and
	// root discovery lists only the router's groups.
	unregisteredGroupHandler http.Handler

	// reconciles and reconcileErrors count completed reconciles, and
	// lastReconcile is when the latest one finished (Unix nanoseconds), for
	// metrics.
	reconciles      atomic.Uint64
	reconcileErrors atomic.Uint64
	lastReconcile   atomic.Int64
	// reconcileDuration is how long each reconcile took, for metrics.
	reconcileDuration durationStats

	// onBreakerChange and onDiscovery report events to the metrics; nil when
	// the router is not instrumented. Set before Run.
	onBreakerChange func(group string, to gobreaker.State)
	onDiscovery     func(group, result string)
	// onBackendFailure reports a backend failure the router saw outside a
	// client request, such as in a discovery read. onWatchEnded reports a
	// watch the router ended itself, and onGroupsRemoved the groups that are
	// no longer served.
	onBackendFailure func(group, pluginID, reason string)
	onWatchEnded     func(group, reason string)
	onGroupsRemoved  func(groups []string)

	watchAuthorizer authorizer.Authorizer

	// watches ends every watch in progress when the router closes them.
	watches    context.Context
	endWatches context.CancelFunc
}

func NewGrafanaRouter(loader RoutesLoader, tokens authn.TokenAuthenticator) *GrafanaRouter {
	r := &GrafanaRouter{
		loader:          loader,
		authn:           tokens,
		served:          map[string]*handlerEntry{},
		watchAuthorizer: grafanaauthz.NewWatchRestrictionAuthorizer(),
		namespaceGroups: allNamespaceGroups{},
	}
	r.watches, r.endWatches = context.WithCancel(context.Background())
	empty := map[string]servingEntry{}
	r.snapshot.Store(&empty)
	r.publishRootDocs(context.Background(), nil)
	r.publishManifestDocs(context.Background(), nil)
	return r
}

var _ Router = (*GrafanaRouter)(nil)

// HandleAPIs serves the /apis tree.
func (r *GrafanaRouter) HandleAPIs() http.HandlerFunc {
	return r.handleAPIs
}

// HandleOpenAPIv3 serves the /openapi/v3 tree.
func (r *GrafanaRouter) HandleOpenAPIv3() http.HandlerFunc {
	return r.handleOpenAPIv3
}

// handlerFor returns the router's handler for the tree path is in, or nil
// when it is in neither. parseInfo reports whether the handler reads the
// request info, so the request metrics parse it for the handler: only /apis
// does.
func (r *GrafanaRouter) handlerFor(path string) (handle http.HandlerFunc, parseInfo bool) {
	switch {
	case path == apisPrefix || strings.HasPrefix(path, apisPrefix+"/"):
		return r.handleAPIs, true
	case path == openapiV3Prefix || strings.HasPrefix(path, openapiV3Prefix+"/"):
		return r.handleOpenAPIv3, false
	}
	return nil, false
}

// serveNotFound answers a request the router has nothing to serve for.
func serveNotFound(w http.ResponseWriter, req *http.Request) {
	setRoute(req, routeNotFound)
	http.NotFound(w, req)
}

// serveHidden answers a request for a group the caller may not see with the
// same 404 as serveNotFound, so the caller can't tell the group exists. Only
// the route label tells them apart.
func serveHidden(w http.ResponseWriter, req *http.Request) {
	setRoute(req, routeHidden)
	http.NotFound(w, req)
}

// handleAPIs serves the /apis tree: discovery, and each group's requests
// proxied to its backend.
func (r *GrafanaRouter) handleAPIs(w http.ResponseWriter, req *http.Request) {
	path := req.URL.Path
	// The request metrics have usually parsed it already. Parsing rejects a
	// path that is not canonical, so a backend serves the group and
	// namespace the request was routed and authorized by.
	var info *request.RequestInfo
	if outcome := outcomeOf(req); outcome != nil && outcome.info != nil {
		info = outcome.info
	} else {
		var err error
		if info, err = utils.NewRequestInfo(req); err != nil {
			setRoute(req, routeInvalid)
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		req = req.WithContext(request.WithRequestInfo(req.Context(), info))
	}
	if req = r.authenticate(w, req); req == nil {
		return
	}
	if !authorizeNamespace(w, req, info.Namespace) {
		return
	}

	// A hidden group does not exist for the caller, so it gets a 404 before
	// any other check could answer differently, such as the watch
	// restriction's 403, and not even the unregistered-group handler may
	// serve it. Root discovery names no group.
	group := info.APIGroup
	if group != "" && !r.visible(req.Context(), r.viewFor(req.Context(), info), group) {
		serveHidden(w, req)
		return
	}
	if info.IsResourceRequest && info.Verb == "watch" {
		decision, reason, err := r.watchAuthorizer.Authorize(req.Context(), authorizer.AttributesRecord{Verb: info.Verb, ResourceRequest: true})
		if err != nil || decision == authorizer.DecisionDeny {
			setRoute(req, routeForbidden)
			_ = errhttp.Write(req.Context(), apierrors.NewForbidden(schema.GroupResource{Group: info.APIGroup, Resource: info.Resource}, info.Name, errors.New(reason)), w)
			return
		}
	}

	// Built by the router, and checked before group dispatch so the tree is
	// never mistaken for a group.
	if isDiscoveryPath(path) {
		r.serveManifestDiscovery(w, req, info)
		return
	}

	// Root discovery (APIGroupList) is the only path that needs a union
	// across every group; synthesize it router-side.
	if path == apisPrefix || path == apisPrefix+"/" {
		setRoute(req, routeDiscovery)
		r.serveAPIGroupList(w, req, info)
		return
	}

	// Parsing rejects an invalid group name, so a group no backend serves is
	// one that could exist: the unregistered-group handler may serve it.
	handlers := *r.snapshot.Load()
	entry, ok := handlers[group]
	if !ok {
		r.serveUnregisteredGroup(w, req, group, info.Verb)
		return
	}

	setRoute(req, routeBackend)
	if rejectUpgrade(w, req) {
		return
	}
	// /apis/<group> group discovery and /apis/<group>/... both proxy to the
	// single owning backend (one backend owns all versions of a group).
	serve := func(w http.ResponseWriter, req *http.Request) {
		entry.serve(group, w, req)
	}
	if info.Verb == "watch" {
		if entry.watching != nil {
			entry.watching.Add(1)
			defer entry.watching.Add(-1)
		}
		r.serveWatch(w, req, group, entry.watches, serve)
		return
	}
	serve(w, req)
}

// pathParts splits path, without its leading "/", into parts, up to the
// capacity of parts. Callers pass a slice of a local array, so splitting a
// request's path doesn't allocate. Beyond that capacity the path is not split:
// callers read no part past it.
func pathParts(path string, parts []string) []string {
	path = strings.TrimPrefix(path, "/")
	for len(parts) < cap(parts) {
		part, rest, more := strings.Cut(path, "/")
		parts = append(parts, part)
		if !more {
			break
		}
		path = rest
	}
	return parts
}

func (r *GrafanaRouter) serveUnregisteredGroup(w http.ResponseWriter, req *http.Request, group, verb string) {
	if group != "" && r.unregisteredGroupHandler != nil {
		setRoute(req, routeFallback)
		if rejectUpgrade(w, req) {
			return
		}
		if verb == "watch" {
			r.serveWatch(w, req, group, nil, r.unregisteredGroupHandler.ServeHTTP)
			return
		}
		r.unregisteredGroupHandler.ServeHTTP(w, req)
		return
	}
	serveNotFound(w, req)
}

// breakerState is the group breaker's state, read without changing it:
// gobreaker's own State moves an open breaker whose timeout passed to
// half-open.
func (e servingEntry) breakerState() gobreaker.State {
	return e.breakerView.State()
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

// rejectBackendRedirects is a ReverseProxy ModifyResponse hook that turns a
// backend redirect into a 502, so a backend can never redirect a caller
// elsewhere.
func rejectBackendRedirects(resp *http.Response) error {
	if resp.StatusCode >= 300 && resp.StatusCode <= 399 && resp.Header.Get("Location") != "" {
		return fmt.Errorf("%w (status %d, location %q)", errBackendRedirect, resp.StatusCode, resp.Header.Get("Location"))
	}
	return nil
}

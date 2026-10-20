package router

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	authlib "github.com/grafana/authlib/types"
	"k8s.io/apimachinery/pkg/util/validation"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	"github.com/grafana/grafana-app-sdk/plugin/httpadapter"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/definition"
)

// namespacedKeyPrefix prefixes the keys of the namespaced groups' backends.
const namespacedKeyPrefix = "namespaced"

// The owner plugin's cluster-scoped route that lists every namespace's
// manifests. GET with the query parameters limit and continue; the response is
// a namespacedManifestsPage. Its path has no leading slash, like the declared
// route paths the router sends for manifest routes.
const (
	namespacedManifestsPath      = "_manifests"
	namespacedManifestsPageLimit = 100
	// maxNamespacedManifestsPages stops a plugin that never ends the list.
	maxNamespacedManifestsPages = 1000
)

// namespacedManifestsPage is one page of the owner plugin's _manifests route.
// Continue is empty on the last page.
type namespacedManifestsPage struct {
	Manifests []*app.ManifestData `json:"manifests"`
	Continue  string              `json:"continue"`
}

// namespacedManifestsTarget serves the namespaced groups of one owner plugin
// group: <name>.<namespace>.<owner group>. The owner plugin lists their
// manifests on its _manifests route, and each becomes a plugin backend of the
// owner plugin, served in that namespace only.
type namespacedManifestsTarget struct {
	backendPoller

	ownerGroup string
	source     string // reported by Backend.Source

	// owners returns the current backends of the source that serves the
	// owner group.
	owners func(context.Context) []Backend
	// serviceContext adds the identity the router polls as.
	serviceContext func(context.Context) context.Context
}

func newNamespacedManifestsTarget(ownerGroup string, owners func(context.Context) []Backend) *namespacedManifestsTarget {
	t := &namespacedManifestsTarget{
		ownerGroup:     ownerGroup,
		source:         namespacedSource(ownerGroup),
		owners:         owners,
		serviceContext: routerServiceContext,
	}
	t.initPoller()
	return t
}

// routerServiceContext polls as the router's own service identity, across
// every namespace. With no caller to exchange for, the v3 client asks the
// token exchange for the router's own token, for the plugin's audience.
func routerServiceContext(ctx context.Context) context.Context {
	return identity.WithServiceIdentityContext(ctx, 1)
}

// run polls until ctx is done; see backendPoller.pollLoop.
func (t *namespacedManifestsTarget) run(ctx context.Context, dirty chan<- struct{}) {
	t.pollLoop(ctx, func(ctx context.Context) { t.poll(ctx, dirty) })
}

func (t *namespacedManifestsTarget) poll(ctx context.Context, dirty chan<- struct{}) {
	now := time.Now()
	log := logging.FromContext(ctx)

	owner, ownerKey, ok := t.findOwner(ctx)
	if !ok {
		// Without the owner, its groups are not served. Retry with backoff,
		// since the owner is usually just not loaded yet.
		t.cooldown.OnFailure(now)
		log.Debug("router: owner of namespaced groups is not loaded", "group", t.ownerGroup)
		t.publish([]Backend{}, map[string]struct{}{}, 0, dirty)
		return
	}

	manifests, err := t.fetch(ctx, owner)
	if err != nil {
		t.cooldown.OnFailure(now)
		t.status.recordFailure()
		log.Warn("router: namespaced manifests poll failed, backing off", "group", t.ownerGroup, "pluginId", owner.pluginID, "err", err)
		return
	}
	t.cooldown.OnSuccess(now)
	t.status.recordSuccess(now)

	backends := make([]Backend, 0, len(manifests))
	keys := make(map[string]struct{}, len(manifests))
	skipped := 0
	for _, manifest := range manifests {
		backend, err := t.newBackend(owner, ownerKey, manifest)
		if err != nil {
			log.Warn("router: skipping namespaced manifest", "group", t.ownerGroup, "pluginId", owner.pluginID, "err", err)
			skipped++
			continue
		}
		if _, dup := keys[backend.Key()]; dup {
			continue
		}
		backends = append(backends, backend)
		keys[backend.Key()] = struct{}{}
	}
	t.publish(backends, keys, skipped, dirty)
}

// findOwner returns the plugin backend serving the owner group, and its key.
func (t *namespacedManifestsTarget) findOwner(ctx context.Context) (*PluginBackend, string, bool) {
	for _, b := range t.owners(ctx) {
		if b.Group().Name != t.ownerGroup {
			continue
		}
		if p, ok := pluginBackendOf(b); ok {
			return p, b.Key(), true
		}
	}
	return nil, "", false
}

// pluginBackendOf returns the plugin backend that b serves.
func pluginBackendOf(b Backend) (*PluginBackend, bool) {
	switch b := b.(type) {
	case *PluginBackend:
		return b, true
	case *pluginDeploymentBackend:
		return pluginBackendOf(b.Backend)
	}
	return nil, false
}

// fetch lists every namespaced manifest from the owner plugin, as the router.
func (t *namespacedManifestsTarget) fetch(ctx context.Context, owner *PluginBackend) ([]*app.ManifestData, error) {
	_, clientV3, err := owner.client(ctx, owner.pluginID)
	if err != nil {
		return nil, err
	}
	if clientV3 == nil {
		return nil, fmt.Errorf("router: plugin %q has no backend to list namespaced manifests", owner.pluginID)
	}
	clientV3, err = v3.WithAuthentication(clientV3, owner.pluginID, []string{owner.group.Name}, owner.tokenExchanger())
	if err != nil {
		return nil, err
	}
	version, ok := namespacedManifestsVersion(owner.manifest, owner.group.PreferredVersion.Version)
	if !ok {
		return nil, fmt.Errorf("router: plugin %q serves no version of %s with the %s route", owner.pluginID, owner.group.Name, namespacedManifestsPath)
	}
	return fetchNamespacedManifests(t.serviceContext(ctx), clientV3, owner.group.Name, version)
}

// namespacedManifestsVersion returns a served version of manifest that
// declares the cluster-scoped _manifests route: preferred, if it does, or else
// the first in the manifest. Loaded manifests carry their routes as OpenAPI
// paths (definition.MigrateDeprecatedRoutes).
func namespacedManifestsVersion(manifest *app.ManifestData, preferred string) (string, bool) {
	if manifest == nil {
		return "", false
	}
	found := ""
	for _, version := range manifest.Versions {
		if _, ok := version.OpenAPI.Paths["/"+namespacedManifestsPath]; !ok || !version.Served {
			continue
		}
		if version.Name == preferred {
			return version.Name, true
		}
		if found == "" {
			found = version.Name
		}
	}
	return found, found != ""
}

// fetchNamespacedManifests calls the _manifests route of group/version,
// following continue tokens until the list ends.
func fetchNamespacedManifests(ctx context.Context, client appclientv3.Client, group, version string) ([]*app.ManifestData, error) {
	forward := httpadapter.HandlerFunc(client)
	routeCtx := httpadapter.WithRouteInfo(ctx, httpadapter.RouteInfo{Group: group, Version: version, Path: namespacedManifestsPath})
	budget := maxPluginManifestsBytes
	seen := map[string]struct{}{}
	var manifests []*app.ManifestData
	token := ""
	for range maxNamespacedManifestsPages {
		query := url.Values{"limit": {strconv.Itoa(namespacedManifestsPageLimit)}}
		if token != "" {
			query.Set("continue", token)
		}
		// The URL is what a caller of the route would request; app-sdk's
		// route adapter dispatches on it.
		target := "/apis/" + group + "/" + version + "/" + namespacedManifestsPath + "?" + query.Encode()
		req, err := http.NewRequestWithContext(routeCtx, http.MethodGet, target, nil)
		if err != nil {
			return nil, fmt.Errorf("router: building namespaced manifests request: %w", err)
		}
		req.Header.Set("Accept", "application/json")

		w := newCaptureWriter(budget, nil)
		forward(w, req)
		if w.overflowed {
			return nil, fmt.Errorf("router: namespaced manifests from %s are larger than %d bytes", group, maxPluginManifestsBytes)
		}
		if w.statusCode != http.StatusOK {
			return nil, fmt.Errorf("router: namespaced manifests request to %s returned status %d", group, w.statusCode)
		}
		budget -= w.body.Len()

		var page namespacedManifestsPage
		if err := json.Unmarshal(w.body.Bytes(), &page); err != nil {
			return nil, fmt.Errorf("router: decoding namespaced manifests from %s: %w", group, err)
		}
		for _, manifest := range page.Manifests {
			definition.MigrateDeprecatedRoutes(manifest)
		}
		manifests = append(manifests, page.Manifests...)

		if page.Continue == "" {
			return manifests, nil
		}
		if _, ok := seen[page.Continue]; ok {
			return nil, fmt.Errorf("router: namespaced manifests from %s repeat continue token", group)
		}
		seen[page.Continue] = struct{}{}
		token = page.Continue
	}
	return nil, fmt.Errorf("router: namespaced manifests from %s have more than %d pages", group, maxNamespacedManifestsPages)
}

// newBackend builds the backend for one namespaced manifest, served by the
// owner plugin, with the owner's clients.
func (t *namespacedManifestsTarget) newBackend(owner *PluginBackend, ownerKey string, manifest *app.ManifestData) (Backend, error) {
	if manifest == nil {
		return nil, errors.New("missing manifest")
	}
	_, namespace, err := parseNamespacedGroup(manifest.Group, t.ownerGroup)
	if err != nil {
		return nil, err
	}
	body, err := json.Marshal(manifest)
	if err != nil {
		return nil, fmt.Errorf("fingerprinting manifest %q: %w", manifest.Group, err)
	}
	// The owner's key covers its host and definition, so a change to either
	// rebuilds its namespaced groups too.
	h := sha256.New()
	_, _ = h.Write(body)
	_, _ = h.Write([]byte{0})
	_, _ = h.Write([]byte(ownerKey))
	sum := h.Sum(nil)

	backend, err := newPluginBackend(owner.pluginID, manifest, owner.client, owner.deps, sum)
	if err != nil {
		return nil, err
	}
	backend.info = owner.info
	backend.hasBackend = owner.hasBackend
	return &namespacedPluginBackend{
		Backend:   backend,
		key:       namespacedKeyPrefix + ":" + owner.pluginID + ":" + hex.EncodeToString(sum)[:16],
		source:    t.source,
		namespace: namespace,
	}, nil
}

// parseNamespacedGroup splits a namespaced group, <name>.<namespace>.<owner>,
// into its name and namespace. The namespace is the single label before the
// owner group, and must be a DNS label; the name may have several labels.
func parseNamespacedGroup(group, owner string) (name, namespace string, err error) {
	rest, ok := strings.CutSuffix(group, "."+owner)
	if !ok || owner == "" {
		return "", "", fmt.Errorf("group %q is not in %s", group, owner)
	}
	dot := strings.LastIndexByte(rest, '.')
	if dot < 0 {
		return "", "", fmt.Errorf("group %q has no namespace: want <name>.<namespace>.%s", group, owner)
	}
	name, namespace = rest[:dot], rest[dot+1:]
	if errs := validation.IsDNS1123Label(namespace); len(errs) > 0 {
		return "", "", fmt.Errorf("group %q has an invalid namespace %q: %s", group, namespace, strings.Join(errs, "; "))
	}
	if name == "" {
		return "", "", fmt.Errorf("group %q has no name: want <name>.<namespace>.%s", group, owner)
	}
	if errs := validation.IsDNS1123Subdomain(group); len(errs) > 0 {
		return "", "", fmt.Errorf("group %q is invalid: %s", group, strings.Join(errs, "; "))
	}
	return name, namespace, nil
}

// namespacedOwnerOf returns the owner, of owners, whose namespaced groups
// include group: the one group ends in, after a dot. Only the owner's
// namespaced source may serve such a group. Any other source refuses it, so
// that no plugin can claim, or shadow, a namespace's group.
func namespacedOwnerOf(group string, owners []string) (string, bool) {
	for _, owner := range owners {
		if strings.HasSuffix(group, "."+owner) {
			return owner, true
		}
	}
	return "", false
}

// namespacedPluginBackend serves one namespace's group for its owner plugin.
type namespacedPluginBackend struct {
	Backend
	key       string
	source    string
	namespace string
}

var _ NamespacedBackend = (*namespacedPluginBackend)(nil)

func (b *namespacedPluginBackend) Key() string    { return b.key }
func (b *namespacedPluginBackend) Source() string { return b.source }

// Namespace implements [NamespacedBackend].
func (b *namespacedPluginBackend) Namespace() string { return b.namespace }

// Load wraps the plugin handler in the namespace guard.
func (b *namespacedPluginBackend) Load(ctx context.Context) (http.Handler, error) {
	handler, err := b.Backend.Load(ctx)
	if err != nil {
		return nil, err
	}
	return &namespaceGuard{next: handler, group: b.Group().Name, namespace: b.namespace}, nil
}

// namespaceGuard keeps a namespace's group to its own namespace: only callers
// in the namespace (or with the wildcard namespace, such as service
// identities) may use it, and only within it. Of the paths without a
// namespace, only root, group and version discovery and the version's
// OpenAPI document are served. Anything else is a 404, so nothing reveals
// that the group exists.
//
// The router itself treats the group as unknown to callers in other
// namespaces, in dispatch and in its discovery documents and caches
// (servingEntry.visibleTo). The guard repeats the caller check, so the
// handler is safe wherever it is reached from, and alone checks the path.
// The OpenAPI cache is kept out by marking the documents private.
type namespaceGuard struct {
	next      http.Handler
	group     string
	namespace string
}

func (g *namespaceGuard) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	requester, err := identity.GetRequester(req.Context())
	if err != nil || requester == nil || !authlib.NamespaceMatches(requester.GetNamespace(), g.namespace) {
		http.NotFound(w, req)
		return
	}
	openapi, ok := g.allowedPath(req.URL.Path)
	if !ok {
		http.NotFound(w, req)
		return
	}
	g.next.ServeHTTP(w, req)
	if openapi {
		// The document is served only to this namespace, so the router's
		// shared OpenAPI cache must not store it.
		w.Header().Add("Cache-Control", "private")
	}
}

// allowedPath reports whether path may be served, and whether it is an
// OpenAPI document.
func (g *namespaceGuard) allowedPath(path string) (openapi, ok bool) {
	if path == apisPrefix {
		// The handler's own root discovery, which the router reads to build
		// aggregated discovery, keeping only this group.
		return false, true
	}
	if rest, found := strings.CutPrefix(path, "/openapi/v3/apis/"+g.group+"/"); found {
		// Only /openapi/v3/apis/<group>/<version>.
		return true, rest != "" && !strings.Contains(rest, "/")
	}
	rest, found := strings.CutPrefix(path, "/apis/"+g.group)
	if !found || (rest != "" && rest[0] != '/') {
		return false, false
	}
	if rest == "" || rest == "/" {
		// Group discovery. Dispatch forwards the trailing slash to every
		// group's handler alike.
		return false, true
	}
	// Any other empty segment, leading, trailing or repeated, is refused
	// rather than trimmed, so the path checked is the path served.
	segments := strings.Split(rest[1:], "/")
	if slices.ContainsFunc(segments, func(s string) bool { return s == "" || s == "." || s == ".." }) {
		return false, false
	}
	switch {
	case len(segments) == 1:
		return false, true // version discovery
	case len(segments) >= 3 && segments[1] == "namespaces":
		return false, segments[2] == g.namespace
	}
	return false, false
}

// PluginStatus implements [PluginStatusProvider]; the embedded Backend
// interface does not promote it.
func (b *namespacedPluginBackend) PluginStatus() (PluginStatus, bool) {
	if p, ok := b.Backend.(PluginStatusProvider); ok {
		return p.PluginStatus()
	}
	return PluginStatus{}, false
}

// Manifest implements [ManifestProvider]; the embedded Backend interface does
// not promote it.
func (b *namespacedPluginBackend) Manifest() (*app.ManifestData, bool) {
	if p, ok := b.Backend.(ManifestProvider); ok {
		return p.Manifest()
	}
	return nil, false
}

// namespacedLoader adds the namespaced groups of owners served by another
// loader, such as the local plugin loader. The owners' own groups win over a
// namespaced group of the same name.
type namespacedLoader struct {
	inner   RoutesLoader
	owners  []string // the owner groups, one per target
	targets []*namespacedManifestsTarget
	dirty   chan struct{} // buffered 1; coalescing wake signal, no payload
	start   sync.Once

	// ownerBackends is the inner loader's latest load, which the targets
	// search for their owners.
	ownerBackends atomic.Pointer[[]Backend]
}

var _ RoutesLoader = (*namespacedLoader)(nil)

func newNamespacedLoader(inner RoutesLoader, ownerGroups []string) *namespacedLoader {
	l := &namespacedLoader{inner: inner, owners: ownerGroups, dirty: make(chan struct{}, 1)}
	owners := func(context.Context) []Backend {
		if owners := l.ownerBackends.Load(); owners != nil {
			return *owners
		}
		return nil
	}
	for _, group := range ownerGroups {
		l.targets = append(l.targets, newNamespacedManifestsTarget(group, owners))
	}
	return l
}

// Notify starts the poll loops, which run until ctx is done, and forwards the
// inner loader's signals.
func (l *namespacedLoader) Notify(ctx context.Context) (<-chan struct{}, error) {
	inner, err := l.inner.Notify(ctx)
	if err != nil {
		return nil, err
	}
	l.start.Do(func() {
		for _, target := range l.targets {
			go target.run(ctx, l.dirty)
		}
		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				case _, ok := <-inner:
					if !ok {
						return
					}
					select {
					case l.dirty <- struct{}{}:
					default: // already pending; coalesce
					}
				}
			}
		}()
	})
	return l.dirty, nil
}

func (l *namespacedLoader) Load(ctx context.Context) ([]Backend, error) {
	loaded, err := l.inner.Load(ctx)
	if err != nil {
		return nil, err
	}
	// Only the owners' namespaced sources serve their namespaced groups.
	backends := slices.DeleteFunc(slices.Clone(loaded), func(b Backend) bool {
		owner, ok := namespacedOwnerOf(b.Group().Name, l.owners)
		if ok {
			logging.FromContext(ctx).Warn("router: skipping plugin group in the namespaced groups of another source", "group", b.Group().Name, "source", b.Source(), "owner", owner)
		}
		return ok
	})
	l.ownerBackends.Store(&backends)

	served := make(map[string]struct{}, len(backends))
	for _, b := range backends {
		served[b.Group().Name] = struct{}{}
	}
	out := slices.Clone(backends)
	for _, target := range l.targets {
		for _, b := range target.Backends() {
			if _, ok := served[b.Group().Name]; ok {
				logging.FromContext(ctx).Warn("router: namespaced group is already served", "group", b.Group().Name, "source", b.Source())
				continue
			}
			served[b.Group().Name] = struct{}{}
			out = append(out, b)
		}
	}
	return out, nil
}

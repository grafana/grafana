package router

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"sync"

	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apiserver/pkg/endpoints"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-app-sdk/app"
	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// The discovery group publishes the app manifests of the served groups as its
// "manifests" resource, alongside a markdown index. Its version is the version
// of the AppManifest kind the documents use, so a new manifest format gets a
// new version rather than changing this one. The router serves the group
// itself; "discovery" has no dot, so no plugin group can claim it.
const (
	discoveryGroup           = "discovery"
	discoveryPrefix          = apisPrefix + "/" + discoveryGroup
	manifestDiscoveryVersion = appmanifestv1alpha2.APIVersion
	manifestDiscoveryPrefix  = discoveryPrefix + "/" + manifestDiscoveryVersion
	discoveryAgentsMD        = manifestDiscoveryPrefix + "/AGENTS.md"
	discoveryAgentsHTML      = manifestDiscoveryPrefix + "/AGENTS"
	manifestDiscoveryList    = manifestDiscoveryPrefix + "/manifests"
	manifestDiscoveryGroups  = manifestDiscoveryList + "/"
)

// manifestDocs holds the /apis/discovery documents for one set of served
// backends. publishManifestDocs rebuilds it only when that set changes.
type manifestDocs struct {
	// manifests holds each group's AppManifest, and items the same documents
	// in group order. The list is written from items on request, so each
	// manifest is held in memory once and never copied into a list buffer.
	manifests map[string]*cachedDoc
	items     []*cachedDoc
	names     []string // each item's name, its group
	listETag  string
	listLen   int

	// The index is rendered on its first request, since most route changes
	// are never followed by one. sources holds each group's published
	// manifest, by group. internal holds the groups only access policies
	// see, so each view has an index of its own.
	backends      []Backend
	sources       map[string]*app.ManifestData
	internal      map[string]struct{}
	publicIndex   indexDocSet
	internalIndex indexDocSet
}

// indexDocSet is one view's index, rendered on its first request.
type indexDocSet struct {
	once  sync.Once
	index cachedDoc // markdown, for agents
	page  cachedDoc // the same index, for browsers
}

var (
	manifestListPrefix = `{"apiVersion":"` + appmanifestv1alpha2.GroupVersion.String() + `","kind":"AppManifestList","metadata":{},"items":[`
	manifestListSuffix = "]}"
)

// The discovery group is advertised in /apis like any served group, and its
// group and version documents are the ones Kubernetes clients expect. Its
// objects are apps.grafana.app AppManifests, which the resource's group and
// version say.
var (
	discoveryGroupVersion = metav1.GroupVersionForDiscovery{
		GroupVersion: discoveryGroup + "/" + manifestDiscoveryVersion,
		Version:      manifestDiscoveryVersion,
	}
	discoveryAPIGroup = metav1.APIGroup{
		Name:             discoveryGroup,
		Versions:         []metav1.GroupVersionForDiscovery{discoveryGroupVersion},
		PreferredVersion: discoveryGroupVersion,
	}
	discoveryResources = []metav1.APIResource{{
		Name:         "manifests",
		SingularName: "manifest",
		Namespaced:   false,
		Group:        appmanifestv1alpha2.APIGroup,
		Version:      appmanifestv1alpha2.APIVersion,
		Kind:         "AppManifest",
		Verbs:        metav1.Verbs{"get", "list"},
	}}
	discoveryGroupDoc = newJSONDoc(metav1.APIGroup{
		TypeMeta:         metav1.TypeMeta{Kind: "APIGroup", APIVersion: "v1"},
		Name:             discoveryAPIGroup.Name,
		Versions:         discoveryAPIGroup.Versions,
		PreferredVersion: discoveryAPIGroup.PreferredVersion,
	})
	discoveryResourcesDoc = newJSONDoc(metav1.APIResourceList{
		TypeMeta:     metav1.TypeMeta{Kind: "APIResourceList", APIVersion: "v1"},
		GroupVersion: discoveryGroupVersion.GroupVersion,
		APIResources: discoveryResources,
	})
	discoveryAggregated = func() apidiscoveryv2.APIGroupDiscovery {
		resources, err := endpoints.ConvertGroupVersionIntoToDiscovery(discoveryResources)
		utilruntime.Must(err)
		return apidiscoveryv2.APIGroupDiscovery{
			ObjectMeta: metav1.ObjectMeta{Name: discoveryGroup},
			Versions: []apidiscoveryv2.APIVersionDiscovery{{
				Version:   manifestDiscoveryVersion,
				Resources: resources,
				Freshness: apidiscoveryv2.DiscoveryFreshnessCurrent,
			}},
		}
	}()
)

func newJSONDoc(value any) cachedDoc {
	body, err := json.Marshal(value)
	utilruntime.Must(err)
	return newCachedDoc("application/json", body)
}

func newCachedDoc(contentType string, body []byte) cachedDoc {
	sum := sha256.Sum256(body)
	return cachedDoc{body: body, etag: quoteETag(hex.EncodeToString(sum[:])[:16]), contentType: contentType}
}

// isDiscoveryPath reports whether path is in the /apis/discovery tree.
func isDiscoveryPath(path string) bool {
	return path == discoveryPrefix || strings.HasPrefix(path, discoveryPrefix+"/")
}

var manifestsResource = schema.GroupResource{Group: discoveryGroup, Resource: "manifests"}

// serveManifestDiscovery serves the /apis/discovery tree from the published
// docs. Errors are Kubernetes Status objects, as from any other group.
func (r *GrafanaRouter) serveManifestDiscovery(w http.ResponseWriter, req *http.Request, info *request.RequestInfo) {
	v := r.viewFor(req.Context(), info)
	path := strings.TrimSuffix(req.URL.Path, "/")
	// A hidden group's manifest gets the same 404 as a group without one; only
	// the route label tells them apart. The first route set is the one kept.
	group, isManifest := strings.CutPrefix(path, manifestDiscoveryGroups)
	isManifest = isManifest && group != "" && !strings.Contains(group, "/")
	hidden := isManifest && !r.visible(req.Context(), v, group)
	if hidden {
		setRoute(req, routeHidden)
	}
	setRoute(req, routeDiscovery)
	if req.Method != http.MethodGet && req.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		_ = errhttp.Write(req.Context(), apierrors.NewMethodNotSupported(manifestsResource, utils.LowerMethod(req.Method)), w)
		return
	}
	// The documents are static, so there is nothing to watch; a list body
	// would be misread as a stream of events.
	if info.Verb == "watch" {
		_ = errhttp.Write(req.Context(), apierrors.NewMethodNotSupported(manifestsResource, "watch"), w)
		return
	}
	docs := r.manifestDocs.Load()
	if r.visibilityScoped {
		w.Header().Set("Cache-Control", "private")
	}
	switch path {
	case discoveryPrefix:
		serveCachedDoc(w, req, &discoveryGroupDoc)
	case manifestDiscoveryPrefix:
		serveCachedDoc(w, req, &discoveryResourcesDoc)
	case manifestDiscoveryList:
		r.serveManifestList(w, req, docs, v)
	case manifestDiscoveryStatus:
		r.serveRouterStatus(w, req)
	case discoveryAgentsMD:
		index, _ := r.indexDocsFor(req.Context(), v)
		serveCachedDoc(w, req, index)
	case discoveryAgentsHTML:
		// The page is static: nothing in it may run or load from elsewhere.
		w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		_, page := r.indexDocsFor(req.Context(), v)
		serveCachedDoc(w, req, page)
	default:
		if !isManifest {
			_ = errhttp.Write(req.Context(), apierrors.NewGenericServerResponse(http.StatusNotFound, req.Method, schema.GroupResource{}, "", "", 0, false), w)
			return
		}
		doc, found := docs.manifests[group]
		if !found || hidden {
			_ = errhttp.Write(req.Context(), apierrors.NewNotFound(manifestsResource, group), w)
			return
		}
		serveCachedDoc(w, req, doc)
	}
}

// serveManifestList writes the AppManifestList from the group documents the
// caller may see, filtered by labelSelector and fieldSelector as Kubernetes
// clients expect. When every group is visible and neither selector is set, it
// serves the precomputed list.
func (r *GrafanaRouter) serveManifestList(w http.ResponseWriter, req *http.Request, docs *manifestDocs, v view) {
	items, etag, length := docs.items, docs.listETag, docs.listLen
	selector, err := parseManifestSelector(req.URL.Query())
	if err != nil {
		_ = errhttp.Write(req.Context(), apierrors.NewBadRequest(err.Error()), w)
		return
	}
	if selector != nil || r.visibilityScoped {
		items, length = nil, len(manifestListPrefix)+len(manifestListSuffix)
		listHash := sha256.New()
		_, _ = io.WriteString(listHash, docs.listETag)
		for i, item := range docs.items {
			if (selector == nil || selector.matches(docs.names[i])) && r.visible(req.Context(), v, docs.names[i]) {
				if len(items) > 0 {
					length++ // the separating comma
				}
				items = append(items, item)
				length += len(item.body)
				_, _ = io.WriteString(listHash, "\x00"+docs.names[i])
			}
		}
		etag = quoteETag(hex.EncodeToString(listHash.Sum(nil))[:16])
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("ETag", etag)
	if req.Header.Get("If-None-Match") == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	w.Header().Set("Content-Length", strconv.Itoa(length))
	w.WriteHeader(http.StatusOK)
	if req.Method != http.MethodHead {
		_ = writeManifestList(w, items)
	}
}

// manifestSelector is a list request's label and field selectors. The
// objects have no labels, and metadata.name is the only field, as for most
// Kubernetes resources.
type manifestSelector struct {
	labels labels.Selector
	fields fields.Selector
}

func parseManifestSelector(query url.Values) (*manifestSelector, error) {
	labelSelector, fieldSelector := query.Get("labelSelector"), query.Get("fieldSelector")
	if labelSelector == "" && fieldSelector == "" {
		return nil, nil
	}
	s := &manifestSelector{labels: labels.Everything(), fields: fields.Everything()}
	var err error
	if labelSelector != "" {
		if s.labels, err = labels.Parse(labelSelector); err != nil {
			return nil, fmt.Errorf("invalid labelSelector: %w", err)
		}
	}
	if fieldSelector != "" {
		if s.fields, err = fields.ParseSelector(fieldSelector); err != nil {
			return nil, fmt.Errorf("invalid fieldSelector: %w", err)
		}
		for _, r := range s.fields.Requirements() {
			if r.Field != "metadata.name" {
				return nil, fmt.Errorf("field label not supported: %s", r.Field)
			}
		}
	}
	return s, nil
}

func (s *manifestSelector) matches(name string) bool {
	return s.labels.Matches(labels.Set(nil)) && s.fields.Matches(fields.Set{"metadata.name": name})
}

func (s *manifestSelector) String() string {
	return s.labels.String() + "\x00" + s.fields.String()
}

func writeManifestList(w io.Writer, items []*cachedDoc) error {
	if _, err := io.WriteString(w, manifestListPrefix); err != nil {
		return err
	}
	for i, item := range items {
		if i > 0 {
			if _, err := io.WriteString(w, ","); err != nil {
				return err
			}
		}
		if _, err := w.Write(item.body); err != nil {
			return err
		}
	}
	_, err := io.WriteString(w, manifestListSuffix)
	return err
}

// publishManifestDocs publishes the documents for backends. It does nothing
// when the served group/key pairs are unchanged, which covers most reconciles,
// and converts only the manifests whose backend key is new: a manifest changes
// only when its key does. Called only from the reconcile goroutine.
func (r *GrafanaRouter) publishManifestDocs(ctx context.Context, backends []Backend) {
	sorted := sortedManifestBackends(backends)
	var fingerprint strings.Builder
	for _, b := range sorted {
		fingerprint.WriteString(b.Group().Name + "=" + b.Key() + ";")
	}
	if r.manifestDocs.Load() != nil && fingerprint.String() == r.manifestFingerprint {
		return
	}
	docs, cache := buildManifestDocsFrom(ctx, sorted, r.builtinManifests, r.manifestCache)
	docs.internal = r.internalGroups
	r.manifestDocs.Store(docs)
	r.manifestCache = cache
	r.manifestFingerprint = fingerprint.String()
}

// buildManifestDocsFrom converts each served manifest to an AppManifest,
// reusing the documents in cache, which is keyed by backend key. It returns
// the cache for the next build, holding only these backends. A manifest that
// fails to convert is left out of the manifests, but its group stays in the
// index; the cache remembers the failure, so it is logged once. builtin holds
// the compiled-in manifests by group, the fallback for backends without one;
// see publishedManifests.
func buildManifestDocsFrom(ctx context.Context, sorted []Backend, builtin map[string]*app.ManifestData, cache map[string]*cachedDoc) (*manifestDocs, map[string]*cachedDoc) {
	sources := publishedManifests(sorted, builtin)
	docs := &manifestDocs{manifests: map[string]*cachedDoc{}, backends: sorted, sources: sources}
	next := make(map[string]*cachedDoc, len(sorted))
	listHash := sha256.New()
	_, _ = io.WriteString(listHash, manifestListPrefix)
	docs.listLen = len(manifestListPrefix) + len(manifestListSuffix)
	for _, b := range sorted {
		manifest, ok := sources[b.Group().Name]
		if !ok {
			continue
		}
		doc, seen := cache[b.Key()]
		if !seen {
			if body, err := appManifestJSON(manifest); err != nil {
				logging.FromContext(ctx).Warn("router: not publishing app manifest", "group", b.Group().Name, "err", err)
			} else {
				converted := newCachedDoc("application/json", body)
				doc = &converted
			}
		}
		next[b.Key()] = doc // nil remembers a failed conversion
		if doc == nil {
			continue
		}
		if len(docs.items) > 0 {
			docs.listLen++ // the separating comma
		}
		docs.items = append(docs.items, doc)
		docs.names = append(docs.names, b.Group().Name)
		docs.manifests[b.Group().Name] = doc
		docs.listLen += len(doc.body)
		_, _ = io.WriteString(listHash, doc.etag)
	}
	docs.listETag = quoteETag(hex.EncodeToString(listHash.Sum(nil))[:16])
	return docs, next
}

var _ resource.ManifestDiscovery = (*GrafanaRouter)(nil)

// ListManifests returns the published manifests, decoded from the documents
// /apis/discovery serves, so in-process readers see exactly what HTTP clients
// do. Each call decodes fresh copies the caller may keep or change.
func (r *GrafanaRouter) ListManifests(ctx context.Context) (*appmanifestv1alpha2.AppManifestList, error) {
	docs := r.manifestDocs.Load()
	list := &appmanifestv1alpha2.AppManifestList{
		TypeMeta: metav1.TypeMeta{APIVersion: appmanifestv1alpha2.GroupVersion.String(), Kind: "AppManifestList"},
		Items:    make([]appmanifestv1alpha2.AppManifest, len(docs.items)),
	}
	for i, doc := range docs.items {
		if err := json.Unmarshal(doc.body, &list.Items[i]); err != nil {
			return nil, fmt.Errorf("decoding app manifest %q: %w", docs.names[i], err)
		}
	}
	return list, nil
}

// GetManifest returns the published manifest of group.
func (r *GrafanaRouter) GetManifest(ctx context.Context, group string) (*appmanifestv1alpha2.AppManifest, error) {
	doc, ok := r.manifestDocs.Load().manifests[group]
	if !ok {
		return nil, apierrors.NewNotFound(manifestsResource, group)
	}
	manifest := &appmanifestv1alpha2.AppManifest{}
	if err := json.Unmarshal(doc.body, manifest); err != nil {
		return nil, fmt.Errorf("decoding app manifest %q: %w", group, err)
	}
	return manifest, nil
}

// publishedManifests returns the manifest published for each backend's group.
// The backend's own manifest (ManifestProvider) is the source of truth. Only
// when a backend advertises none, so the router does not know what it serves,
// does it fall back to the manifest compiled into this binary for the group
// (resource.AppManifests). That manifest is a best guess: the backend may run
// another release, so it is limited to the versions the backend serves.
//
// Neither input changes while a backend's key does not: reconcile keeps the
// served Backend until its key changes, and Group must change only with Key.
// So the fingerprint and documents cached by key stay valid.
func publishedManifests(backends []Backend, builtin map[string]*app.ManifestData) map[string]*app.ManifestData {
	out := make(map[string]*app.ManifestData, len(backends))
	for _, b := range backends {
		group := b.Group()
		if manifest, ok := backendManifest(b); ok {
			out[group.Name] = manifest
		} else if manifest, ok := servedManifestVersions(builtin[group.Name], group); ok {
			out[group.Name] = manifest
		}
	}
	return out
}

// servedManifestVersions returns m with only the versions group serves, each
// marked served, or false when it has none of them. The backend may run
// another release, and serve a version this binary no longer does, so whether
// a version is served is the backend's answer, not m's. It copies m only when
// that changes it.
func servedManifestVersions(m *app.ManifestData, group metav1.APIGroup) (*app.ManifestData, bool) {
	if m == nil {
		return nil, false
	}
	served := make(map[string]bool, len(group.Versions))
	for _, v := range group.Versions {
		served[v.Version] = true
	}
	versions := make([]app.ManifestVersion, 0, len(m.Versions))
	changed := false
	for _, v := range m.Versions {
		if !served[v.Name] {
			changed = true
			continue
		}
		if !v.Served {
			v.Served = true
			changed = true
		}
		versions = append(versions, v)
	}
	if len(versions) == 0 {
		return nil, false
	}
	if !changed {
		return m, true
	}
	kept := func(name string) bool {
		return slices.ContainsFunc(versions, func(v app.ManifestVersion) bool { return v.Name == name })
	}
	out := *m
	out.Versions = versions
	if !kept(out.PreferredVersion) {
		// An empty preferred version means the latest of versions.
		out.PreferredVersion = ""
		if kept(group.PreferredVersion.Version) {
			out.PreferredVersion = group.PreferredVersion.Version
		}
	}
	return &out, true
}

// manifestsByGroup indexes manifests by group, for publishedManifests.
func manifestsByGroup(manifests []*app.ManifestData) map[string]*app.ManifestData {
	out := make(map[string]*app.ManifestData, len(manifests))
	for _, m := range manifests {
		if m != nil && m.Group != "" {
			out[m.Group] = m
		}
	}
	return out
}

func backendManifest(b Backend) (*app.ManifestData, bool) {
	provider, ok := b.(ManifestProvider)
	if !ok {
		return nil, false
	}
	manifest, ok := provider.Manifest()
	return manifest, ok && manifest != nil
}

// appManifestJSON renders a manifest as an apps.grafana.app/v1alpha2
// AppManifest named by its group, which is unique among the served manifests
// while app names need not be. Operator and ExtraPermissions describe how the
// app's own backend is deployed and authorized, not the API clients call, so
// they are left out.
func appManifestJSON(manifest *app.ManifestData) ([]byte, error) {
	data := *manifest
	data.Operator = nil
	data.ExtraPermissions = nil
	spec, err := appmanifestv1alpha2.SpecFromManifestData(data)
	if err != nil {
		return nil, err
	}
	return json.Marshal(struct {
		metav1.TypeMeta `json:",inline"`
		Metadata        metav1.ObjectMeta                   `json:"metadata"`
		Spec            appmanifestv1alpha2.AppManifestSpec `json:"spec"`
	}{
		TypeMeta: metav1.TypeMeta{APIVersion: appmanifestv1alpha2.GroupVersion.String(), Kind: "AppManifest"},
		Metadata: metav1.ObjectMeta{Name: manifest.Group},
		Spec:     *spec,
	})
}

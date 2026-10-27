package router

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"sync"

	"github.com/russross/blackfriday/v2"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apiserver/pkg/endpoints"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/grafana/grafana-app-sdk/logging"
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

// maxIndexTextLen bounds each manifest-supplied summary in the markdown index.
const maxIndexTextLen = 200

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
	// are never followed by one.
	backends  []Backend
	indexOnce sync.Once
	index     cachedDoc // markdown, for agents
	indexHTML cachedDoc // the same index, for browsers
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
func (r *GrafanaRouter) serveManifestDiscovery(w http.ResponseWriter, req *http.Request) {
	setRoute(req, routeDiscovery)
	if req.Method != http.MethodGet && req.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		_ = errhttp.Write(req.Context(), apierrors.NewMethodNotSupported(manifestsResource, strings.ToLower(req.Method)), w)
		return
	}
	// The documents are static, so there is nothing to watch; a list body
	// would be misread as a stream of events.
	if requestVerb(req) == "watch" {
		_ = errhttp.Write(req.Context(), apierrors.NewMethodNotSupported(manifestsResource, "watch"), w)
		return
	}
	docs, public := r.manifestDocs.Load(), r.publicManifestDocs.Load()
	if docs != public && !r.seesFullVariant(w, req) {
		docs = public
	}
	switch path := strings.TrimSuffix(req.URL.Path, "/"); path {
	case discoveryPrefix:
		serveCachedDoc(w, req, &discoveryGroupDoc)
	case manifestDiscoveryPrefix:
		serveCachedDoc(w, req, &discoveryResourcesDoc)
	case manifestDiscoveryList:
		serveManifestList(w, req, docs)
	case manifestDiscoveryStatus:
		r.serveRouterStatus(w, req)
	case discoveryAgentsMD:
		index, _ := docs.indexDocs()
		serveCachedDoc(w, req, index)
	case discoveryAgentsHTML:
		// The page is static: nothing in it may run or load from elsewhere.
		w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		_, page := docs.indexDocs()
		serveCachedDoc(w, req, page)
	default:
		group, ok := strings.CutPrefix(path, manifestDiscoveryGroups)
		if !ok || strings.Contains(group, "/") {
			_ = errhttp.Write(req.Context(), apierrors.NewGenericServerResponse(http.StatusNotFound, req.Method, schema.GroupResource{}, "", "", 0, false), w)
			return
		}
		doc, found := docs.manifests[group]
		if !found {
			_ = errhttp.Write(req.Context(), apierrors.NewNotFound(manifestsResource, group), w)
			return
		}
		serveCachedDoc(w, req, doc)
	}
}

// serveManifestList writes the AppManifestList from the group documents,
// filtered by labelSelector and fieldSelector as Kubernetes clients expect.
// Without either, it serves the precomputed list.
func serveManifestList(w http.ResponseWriter, req *http.Request, docs *manifestDocs) {
	items, etag, length := docs.items, docs.listETag, docs.listLen
	selector, err := parseManifestSelector(req.URL.Query())
	if err != nil {
		_ = errhttp.Write(req.Context(), apierrors.NewBadRequest(err.Error()), w)
		return
	}
	if selector != nil {
		items, length = nil, len(manifestListPrefix)+len(manifestListSuffix)
		for i, item := range docs.items {
			if selector.matches(docs.names[i]) {
				if len(items) > 0 {
					length++ // the separating comma
				}
				items = append(items, item)
				length += len(item.body)
			}
		}
		etag = quoteETag(hashHex(docs.listETag + "\x00" + selector.String()))
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

func (d *manifestDocs) writeList(w io.Writer) error {
	return writeManifestList(w, d.items)
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

// indexDocs returns the markdown and HTML index, rendering them once.
func (d *manifestDocs) indexDocs() (index, page *cachedDoc) {
	d.indexOnce.Do(func() {
		markdown := []byte(renderManifestIndex(d.backends, d.manifests))
		d.index = newCachedDoc("text/markdown; charset=utf-8", markdown)
		d.indexHTML = newCachedDoc("text/html; charset=utf-8", renderIndexHTML(markdown))
	})
	return &d.index, &d.indexHTML
}

// publishManifestDocs publishes the documents for backends, and their public
// variant without the restricted groups. It does nothing when the served
// group/key pairs are unchanged, which covers most reconciles, and converts
// only the manifests whose backend key is new: a manifest changes only when
// its key does. Called only from the reconcile goroutine.
func (r *GrafanaRouter) publishManifestDocs(ctx context.Context, backends []Backend) {
	sorted := sortedManifestBackends(backends)
	var fingerprint strings.Builder
	for _, b := range sorted {
		fingerprint.WriteString(b.Group().Name + "=" + b.Key())
		if restrictedBackend(b) {
			fingerprint.WriteString("!")
		}
		fingerprint.WriteString(";")
	}
	if r.manifestDocs.Load() != nil && fingerprint.String() == r.manifestFingerprint {
		return
	}
	docs, cache := buildManifestDocsFrom(ctx, sorted, r.manifestCache)
	public := docs
	if publicBackends := slices.DeleteFunc(slices.Clone(sorted), restrictedBackend); len(publicBackends) != len(sorted) {
		// Every public backend is in cache, so nothing is converted again.
		public, _ = buildManifestDocsFrom(ctx, publicBackends, cache)
	}
	r.publicManifestDocs.Store(public)
	r.manifestDocs.Store(docs)
	r.manifestCache = cache
	r.manifestFingerprint = fingerprint.String()
}

// buildManifestDocs builds the documents for backends without a cache.
func buildManifestDocs(ctx context.Context, backends []Backend) *manifestDocs {
	docs, _ := buildManifestDocsFrom(ctx, sortedManifestBackends(backends), nil)
	return docs
}

// buildManifestDocsFrom converts each served manifest to an AppManifest,
// reusing the documents in cache, which is keyed by backend key. It returns
// the cache for the next build, holding only these backends. A manifest that
// fails to convert is left out of the manifests, but its group stays in the
// index; the cache remembers the failure, so it is logged once.
func buildManifestDocsFrom(ctx context.Context, sorted []Backend, cache map[string]*cachedDoc) (*manifestDocs, map[string]*cachedDoc) {
	docs := &manifestDocs{manifests: map[string]*cachedDoc{}, backends: sorted}
	next := make(map[string]*cachedDoc, len(sorted))
	listHash := sha256.New()
	_, _ = io.WriteString(listHash, manifestListPrefix)
	docs.listLen = len(manifestListPrefix) + len(manifestListSuffix)
	for _, b := range sorted {
		manifest, ok := backendManifest(b)
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
// /apis/discovery serves, so in-process readers see exactly what internal HTTP
// clients do, restricted groups included. Each call decodes fresh copies the
// caller may keep or change.
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

// renderManifestIndex renders the markdown index of every served group, for
// agents and other clients that read documentation rather than schemas.
func renderManifestIndex(backends []Backend, published map[string]*cachedDoc) string {
	var b strings.Builder
	b.WriteString(`# Grafana API index

Grafana's APIs follow Kubernetes API conventions. Every request needs the same credentials as the rest of the API.

## Discovery

- ` + "`GET " + manifestDiscoveryList + "`" + ` (the ` + "`manifests`" + ` resource of the ` + "`" + discoveryGroup + "`" + ` group, so ` + "`kubectl get manifests." + discoveryGroup + "`" + ` works too): every app manifest listed below, as an ` + "`AppManifestList` (`" + appmanifestv1alpha2.GroupVersion.String() + "`)" + `.
- ` + "`GET " + manifestDiscoveryGroups + "{group}`" + `: one group's ` + "`AppManifest`" + `, with its kinds, schemas, custom routes and roles.
- ` + "`GET " + discoveryAgentsMD + "`" + `: this index; ` + "`" + discoveryAgentsHTML + "`" + ` renders it for browsers.
- ` + "`GET " + manifestDiscoveryStatus + "`" + `: the router's live status, for debugging: each group's source, breaker and backend.
- ` + "`GET /apis`" + `: Kubernetes API discovery. Send ` + "`Accept: " + aggregatedDiscoveryJSON + "`" + ` to get every resource in one response. Groups listed there but not here publish no manifest.
- ` + "`GET /openapi/v3/apis/{group}/{version}`" + `: the OpenAPI v3 document for one group version.

## Resource paths

- Namespaced: ` + "`/apis/{group}/{version}/namespaces/{namespace}/{resource}[/{name}]`" + `
- Cluster-scoped: ` + "`/apis/{group}/{version}/{resource}[/{name}]`" + `

A list request returns a ` + "`{Kind}List`" + `;.
`)

	b.WriteString("\n## Groups\n\n| Group | App | Preferred version | Versions |\n| --- | --- | --- | --- |\n")
	for _, backend := range backends {
		group := backend.Group()
		manifest, _ := backendManifest(backend)
		appName := ""
		if manifest != nil {
			appName = manifestDisplayName(manifest)
		}
		versions := make([]string, 0, len(group.Versions))
		for _, v := range group.Versions {
			versions = append(versions, v.Version)
		}
		fmt.Fprintf(&b, "| %s | %s | %s | %s |\n", mdCode(group.Name), mdText(appName), mdText(group.PreferredVersion.Version), mdText(strings.Join(versions, ", ")))
	}

	for _, backend := range backends {
		group := backend.Group()
		manifest, _ := backendManifest(backend)
		title := mdCode(group.Name)
		if manifest != nil {
			if name := manifestDisplayName(manifest); name != "" {
				title = mdText(name) + " (" + mdCode(group.Name) + ")"
			}
		}
		fmt.Fprintf(&b, "\n## %s\n\n", title)
		if _, ok := published[group.Name]; ok {
			b.WriteString("Manifest: " + mdLink(manifestDiscoveryGroups+group.Name, manifestDiscoveryGroups+url.PathEscape(group.Name)) + "\n")
		} else {
			b.WriteString("No app manifest is published for this group; see `/apis` and OpenAPI for its resources.\n")
		}
		writeGroupVersions(&b, backend, manifest)
	}
	return b.String()
}

func manifestDisplayName(m *app.ManifestData) string {
	if m.AppDisplayName != "" {
		return m.AppDisplayName
	}
	return m.AppName
}

// writeGroupVersions writes each served version of a group: its kinds and
// custom routes from the manifest, or else the resources the backend
// provides for discovery.
func writeGroupVersions(b *strings.Builder, backend Backend, manifest *app.ManifestData) {
	group := backend.Group()
	var discovery *apidiscoveryv2.APIGroupDiscovery
	if provider, ok := backend.(DiscoveryProvider); ok {
		if d, ok := provider.Discovery(); ok {
			discovery = &d
		}
	}
	for _, gv := range group.Versions {
		heading := gv.Version
		if gv.Version == group.PreferredVersion.Version {
			heading += " (preferred)"
		}
		// The hash only busts caches, so it goes in the link, not its text.
		path := openapiV3Prefix + "/apis/" + group.Name + "/" + gv.Version
		target := openapiV3Prefix + "/apis/" + url.PathEscape(group.Name) + "/" + url.PathEscape(gv.Version) + "?hash=" + url.QueryEscape(backend.Key())
		fmt.Fprintf(b, "\n### %s\n\nOpenAPI: %s\n", mdText(heading), mdLink(path, target))

		switch {
		case manifest != nil:
			idx := slices.IndexFunc(manifest.Versions, func(v app.ManifestVersion) bool { return v.Name == gv.Version })
			if idx < 0 {
				continue
			}
			version := manifest.Versions[idx]
			if len(version.Kinds) > 0 {
				b.WriteString("\n| Kind | Resource | Scope |\n| --- | --- | --- |\n")
				for _, kind := range version.Kinds {
					fmt.Fprintf(b, "| %s | %s | %s |\n", mdText(kind.Kind), mdCode(kind.Resource()), mdText(kindScope(kind.Scope)))
				}
			}
			writeCustomRoutes(b, "/apis/"+gv.GroupVersion, version.OpenAPI.Paths)
		case discovery != nil:
			idx := slices.IndexFunc(discovery.Versions, func(v apidiscoveryv2.APIVersionDiscovery) bool { return v.Version == gv.Version })
			if idx < 0 || len(discovery.Versions[idx].Resources) == 0 {
				continue
			}
			b.WriteString("\n| Kind | Resource | Scope |\n| --- | --- | --- |\n")
			for _, res := range discovery.Versions[idx].Resources {
				kind := ""
				if res.ResponseKind != nil {
					kind = res.ResponseKind.Kind
				}
				fmt.Fprintf(b, "| %s | %s | %s |\n", mdText(kind), mdCode(res.Resource), mdText(string(res.Scope)))
			}
		}
	}
}

// kindScope names a manifest kind's scope; manifests leave it empty for the
// default, namespaced.
func kindScope(scope string) string {
	if scope == "" {
		return "Namespaced"
	}
	return scope
}

// writeCustomRoutes lists a version's custom routes. Their paths are relative
// to the group version.
func writeCustomRoutes(b *strings.Builder, prefix string, paths map[string]spec3.PathProps) {
	if len(paths) == 0 {
		return
	}
	b.WriteString("\nCustom routes:\n\n")
	for _, path := range slices.Sorted(maps.Keys(paths)) {
		props := paths[path]
		for _, op := range []struct {
			method string
			op     *spec3.Operation
		}{
			{http.MethodGet, props.Get}, {http.MethodPost, props.Post}, {http.MethodPut, props.Put},
			{http.MethodPatch, props.Patch}, {http.MethodDelete, props.Delete},
		} {
			if op.op == nil {
				continue
			}
			summary := op.op.Summary
			if summary == "" {
				summary = op.op.Description
			}
			if summary == "" {
				summary = props.Summary
			}
			line := "- " + mdCode(op.method+" "+prefix+"/"+strings.TrimPrefix(path, "/"))
			if summary = mdText(summary); summary != "" {
				line += ": " + summary
			}
			b.WriteString(line + "\n")
		}
	}
}

const indexHTMLHead = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Grafana API index</title>
<style>
:root { color-scheme: light dark; }
body { font-family: system-ui, sans-serif; line-height: 1.5; max-width: 72rem; margin: 0 auto; padding: 1rem; }
code { font-family: ui-monospace, monospace; font-size: 0.9em; }
table { border-collapse: collapse; margin: 0.5rem 0; }
th, td { border: 1px solid #8884; padding: 0.25rem 0.75rem; text-align: left; }
h2 { border-bottom: 1px solid #8884; padding-top: 1rem; }
</style>
</head>
<body>
`

const indexHTMLFoot = "</body>\n</html>\n"

// renderIndexHTML renders the markdown index as a plain page. Raw HTML in the
// markdown is dropped, so manifest text can only ever be text.
func renderIndexHTML(markdown []byte) []byte {
	renderer := relativeLinksRenderer{blackfriday.NewHTMLRenderer(blackfriday.HTMLRendererParameters{
		Flags: blackfriday.SkipHTML | blackfriday.Safelink,
	})}
	body := blackfriday.Run(markdown,
		blackfriday.WithExtensions(blackfriday.NoIntraEmphasis|blackfriday.Tables|blackfriday.SpaceHeadings),
		blackfriday.WithRenderer(renderer))
	page := make([]byte, 0, len(indexHTMLHead)+len(body)+len(indexHTMLFoot))
	page = append(page, indexHTMLHead...)
	page = append(page, body...)
	return append(page, indexHTMLFoot...)
}

// relativeLinksRenderer renders a link or image only when its target is a
// path on this server, the only kind the index writes. Any other keeps just
// its text, so a gap in escaping can never link the page elsewhere.
type relativeLinksRenderer struct{ *blackfriday.HTMLRenderer }

func (r relativeLinksRenderer) RenderNode(w io.Writer, node *blackfriday.Node, entering bool) blackfriday.WalkStatus {
	if (node.Type == blackfriday.Link || node.Type == blackfriday.Image) && !isRelativePath(string(node.Destination)) {
		return blackfriday.GoToNext // skip the tag; its children render as text
	}
	return r.HTMLRenderer.RenderNode(w, node, entering)
}

// isRelativePath reports whether target is a path on this server: a single
// leading "/", and nothing but printable ASCII other than space and
// backslash. Browsers read "//host" and "/\\host" as another host, and drop
// tabs and line breaks before parsing, so "/\t/host" means "//host"; any such
// character fails the check, wherever it is. The index URL-escapes every
// target, so its own links always pass.
func isRelativePath(target string) bool {
	if len(target) < 1 || target[0] != '/' || (len(target) > 1 && target[1] == '/') {
		return false
	}
	for i := 0; i < len(target); i++ {
		if c := target[i]; c <= ' ' || c > '~' || c == '\\' {
			return false
		}
	}
	return true
}

// mdEscaper backslash-escapes the characters that are active inside a markdown
// line, the backslash itself among them, so escaped text is only ever text: it
// cannot open a code span, link, image, emphasis, entity or HTML, nor end a
// table cell. Text never starts a line here, so block syntax needs no escape.
var mdEscaper = func() *strings.Replacer {
	const active = "\\`*_[]<>|&~"
	pairs := make([]string, 0, 2*len(active))
	for _, c := range active {
		pairs = append(pairs, string(c), `\`+string(c))
	}
	return strings.NewReplacer(pairs...)
}()

// mdText makes manifest-supplied text safe for one markdown line or table
// cell: a single line, escaped, and bounded in length. It truncates before
// escaping, so it never splits an escape.
func mdText(s string) string {
	s = strings.Join(strings.Fields(s), " ")
	if r := []rune(s); len(r) > maxIndexTextLen {
		s = string(r[:maxIndexTextLen]) + "…"
	}
	return mdEscaper.Replace(s)
}

// mdLink links text, shown as code, to target. The caller URL-escapes every
// part of target it did not write itself, which leaves nothing in it that can
// end the link. Brackets are dropped from the text: markdown ends a link's
// text at the first "]" even inside a code span, where it cannot be escaped,
// so a name could otherwise close the text early and supply its own target.
func mdLink(text, target string) string {
	label := mdCode(strings.NewReplacer("[", "", "]", "").Replace(text))
	if !isRelativePath(target) {
		return label // the index only links to this server
	}
	return "[" + label + "](" + target + ")"
}

// mdCode renders s as an inline code span that can sit in a table cell.
// Backticks and backslashes are dropped, since a code span has no escapes:
// one would end the span, the other could escape the pipe after it.
func mdCode(s string) string {
	s = strings.NewReplacer("`", "", `\`, "", "|", `\|`).Replace(strings.Join(strings.Fields(s), " "))
	if s == "" {
		return ""
	}
	return "`" + s + "`"
}

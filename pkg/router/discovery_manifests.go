package router

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"slices"
	"strings"

	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/validation"
	"k8s.io/apiserver/pkg/endpoints"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/russross/blackfriday/v2"

	"github.com/grafana/grafana-app-sdk/app"
	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// The discovery group publishes the app manifests of the served groups as its
// "manifests" resource, alongside a markdown index. Its version is the version
// of the AppManifest kind the documents use, so a new manifest format gets a
// new version rather than changing this one. The router serves the group
// itself; "discovery" has no dot, so no plugin group can claim it.
const (
	discoveryGroup             = "discovery"
	discoveryPrefix            = apisPrefix + "/" + discoveryGroup
	manifestDiscoveryVersion   = appmanifestv1alpha2.APIVersion
	manifestDiscoveryPrefix    = discoveryPrefix + "/" + manifestDiscoveryVersion
	manifestDiscoveryIndex     = manifestDiscoveryPrefix + "/index.md"
	manifestDiscoveryIndexHTML = manifestDiscoveryPrefix + "/index.html"
	manifestDiscoveryList      = manifestDiscoveryPrefix + "/manifests"
	manifestDiscoveryGroups    = manifestDiscoveryList + "/"
)

// maxIndexTextLen bounds each manifest-supplied summary in the markdown index.
const maxIndexTextLen = 200

// manifestDocs holds every /discovery document, built once per reconcile from
// the served backends.
type manifestDocs struct {
	list      cachedDoc // AppManifestList of every manifest
	index     cachedDoc // markdown index for agents
	indexHTML cachedDoc // the same index rendered for browsers
	// manifests holds each group's AppManifest. The bodies share list's
	// backing array, so the manifests are held in memory only once.
	manifests map[string]cachedDoc
}

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
	docs := r.manifestDocs.Load()
	switch path := strings.TrimSuffix(req.URL.Path, "/"); path {
	case discoveryPrefix:
		serveCachedDoc(w, req, &discoveryGroupDoc)
	case manifestDiscoveryPrefix:
		serveCachedDoc(w, req, &discoveryResourcesDoc)
	case manifestDiscoveryList:
		serveCachedDoc(w, req, &docs.list)
	case manifestDiscoveryStatus:
		r.serveRouterStatus(w, req)
	case manifestDiscoveryIndex:
		serveCachedDoc(w, req, &docs.index)
	case manifestDiscoveryIndexHTML:
		// The page is static: nothing in it may run or load from elsewhere.
		w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		serveCachedDoc(w, req, &docs.indexHTML)
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
		serveCachedDoc(w, req, &doc)
	}
}

// buildManifestDocs converts each served manifest to an AppManifest and
// renders the markdown index. A manifest that fails to convert is left out of
// the manifests, but its group stays in the index.
func buildManifestDocs(ctx context.Context, backends []Backend) manifestDocs {
	sorted := sortedManifestBackends(backends)
	docs := manifestDocs{manifests: map[string]cachedDoc{}}

	var list bytes.Buffer
	list.WriteString(`{"apiVersion":"` + appmanifestv1alpha2.GroupVersion.String() + `","kind":"AppManifestList","metadata":{},"items":[`)
	type span struct{ start, end int }
	spans := map[string]span{}
	for _, b := range sorted {
		manifest, ok := backendManifest(b)
		if !ok {
			continue
		}
		body, err := appManifestJSON(manifest)
		if err != nil {
			logging.FromContext(ctx).Warn("router: not publishing app manifest", "group", b.Group().Name, "err", err)
			continue
		}
		if len(spans) > 0 {
			list.WriteByte(',')
		}
		start := list.Len()
		list.Write(body)
		spans[b.Group().Name] = span{start, list.Len()}
	}
	list.WriteString("]}")

	listBody := list.Bytes()
	docs.list = newCachedDoc("application/json", listBody)
	for group, s := range spans {
		// Capping the capacity keeps an append to one manifest from writing
		// into the next.
		docs.manifests[group] = newCachedDoc("application/json", listBody[s.start:s.end:s.end])
	}
	index := []byte(renderManifestIndex(sorted, docs.manifests))
	docs.index = newCachedDoc("text/markdown; charset=utf-8", index)
	docs.indexHTML = newCachedDoc("text/html; charset=utf-8", renderIndexHTML(index))
	return docs
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
func renderManifestIndex(backends []Backend, published map[string]cachedDoc) string {
	var b strings.Builder
	b.WriteString(`# Grafana API index

Grafana's APIs follow Kubernetes API conventions. Every request needs the same credentials as the rest of the API.

## Discovery

- ` + "`GET " + manifestDiscoveryList + "`" + ` (the ` + "`manifests`" + ` resource of the ` + "`" + discoveryGroup + "`" + ` group, so ` + "`kubectl get manifests." + discoveryGroup + "`" + ` works too): every app manifest listed below, as an ` + "`AppManifestList` (`" + appmanifestv1alpha2.GroupVersion.String() + "`)" + `.
- ` + "`GET " + manifestDiscoveryGroups + "{group}`" + `: one group's ` + "`AppManifest`" + `, with its kinds, schemas, custom routes and roles.
- ` + "`GET " + manifestDiscoveryStatus + "`" + `: the router's live status, for debugging: each group's source, breaker and backend.
- ` + "`GET /apis`" + `: Kubernetes API discovery. Send ` + "`Accept: " + aggregatedDiscoveryJSON + "`" + ` to get every resource in one response. Groups listed there but not here publish no manifest.
- ` + "`GET /openapi/v3/apis/{group}/{version}`" + `: the OpenAPI v3 document for one group version.

## Resource paths

- Namespaced: ` + "`/apis/{group}/{version}/namespaces/{namespace}/{resource}[/{name}]`" + `
- Cluster-scoped: ` + "`/apis/{group}/{version}/{resource}[/{name}]`" + `

A list request returns a ` + "`{Kind}List`" + `; a watch adds ` + "`?watch=true`" + ` to a list path.
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
			b.WriteString("Manifest: " + mdLink(manifestDiscoveryGroups, group.Name) + "\n")
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
		fmt.Fprintf(b, "\n### %s\n\nOpenAPI: %s\n", mdText(heading), mdCode(openapiV3Prefix+"/apis/"+gv.GroupVersion+"?hash="+backend.Key()))

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
	renderer := blackfriday.NewHTMLRenderer(blackfriday.HTMLRendererParameters{
		Flags: blackfriday.SkipHTML | blackfriday.Safelink,
	})
	body := blackfriday.Run(markdown,
		blackfriday.WithExtensions(blackfriday.NoIntraEmphasis|blackfriday.Tables|blackfriday.SpaceHeadings),
		blackfriday.WithRenderer(renderer))
	page := make([]byte, 0, len(indexHTMLHead)+len(body)+len(indexHTMLFoot))
	page = append(page, indexHTMLHead...)
	page = append(page, body...)
	return append(page, indexHTMLFoot...)
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

// mdLink links to prefix+group when the group is a valid name, so it can
// carry nothing but name characters into the link; otherwise it is plain code.
func mdLink(prefix, group string) string {
	if len(validation.IsDNS1123Subdomain(group)) > 0 {
		return mdCode(prefix + group)
	}
	return "[" + mdCode(prefix+group) + "](" + prefix + group + ")"
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

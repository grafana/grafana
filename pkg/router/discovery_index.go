package router

import (
	"fmt"
	"io"
	"maps"
	"net/http"
	"net/url"
	"slices"
	"strings"

	"github.com/russross/blackfriday/v2"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
)

// maxIndexTextLen bounds each piece of manifest-supplied text in the markdown
// index, in runes.
const maxIndexTextLen = 200

// indexDocs returns the markdown and HTML index, rendering each view once:
// with internal, every group, and without it, only those not internal.
func (d *manifestDocs) indexDocs(internal bool) (index, page *cachedDoc) {
	if len(d.internal) == 0 {
		internal = false // both views are the same
	}
	docs := &d.publicIndex
	if internal {
		docs = &d.internalIndex
	}
	docs.once.Do(func() {
		backends := d.backends
		if !internal && len(d.internal) > 0 {
			backends = make([]Backend, 0, len(d.backends))
			for _, b := range d.backends {
				if _, hidden := d.internal[b.Group().Name]; !hidden {
					backends = append(backends, b)
				}
			}
		}
		markdown := []byte(renderManifestIndex(backends, d.sources, d.manifests))
		docs.index = newCachedDoc("text/markdown; charset=utf-8", markdown)
		docs.page = newCachedDoc("text/html; charset=utf-8", renderIndexHTML(markdown))
	})
	return &docs.index, &docs.page
}

// renderManifestIndex renders the markdown index of every served group, for
// agents and other clients that read documentation rather than schemas.
func renderManifestIndex(backends []Backend, sources map[string]*app.ManifestData, published map[string]*cachedDoc) string {
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

A list request returns a ` + "`{Kind}List`" + `.
`)

	b.WriteString("\n## Groups\n\n| Group | App | Preferred version | Versions |\n| --- | --- | --- | --- |\n")
	for _, backend := range backends {
		group := backend.Group()
		manifest := sources[group.Name]
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
		manifest := sources[group.Name]
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
	return mdEscaper.Replace(truncateIndexText(strings.Join(strings.Fields(s), " ")))
}

// truncateIndexText cuts s to maxIndexTextLen runes.
func truncateIndexText(s string) string {
	if r := []rune(s); len(r) > maxIndexTextLen {
		return string(r[:maxIndexTextLen]) + "…"
	}
	return s
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
// one would end the span, the other could escape the pipe after it. Like
// mdText, it truncates before escaping.
func mdCode(s string) string {
	s = strings.NewReplacer("`", "", `\`, "", "|", `\|`).Replace(truncateIndexText(strings.Join(strings.Fields(s), " ")))
	if s == "" {
		return ""
	}
	return "`" + s + "`"
}

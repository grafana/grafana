package definition

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"reflect"
	"strings"

	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	manifestroutes "github.com/grafana/grafana-app-sdk/routes"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
)

// SettingsProxyRoot is where the proxy routes are declared in the settings
// manifest's version: below the proxy subresource of the settings object.
const SettingsProxyRoot = "/namespaces/{namespace}/" + apppluginV0.APP_RESOURCE_NAME + "/{name}/proxy"

// settingsKind is the kind the settings API serves its one object as.
var settingsKind = app.ManifestVersionKind{
	Kind:     "Settings",
	Plural:   "Settings",
	Resource: apppluginV0.APP_RESOURCE_NAME,
	Scope:    "Namespaced",
}

// SettingsRouteOptions are the rules the settings manifest's routes are parsed
// with, when it is loaded and when it is served.
var SettingsRouteOptions = manifestroutes.Options{UnservedMethods: []string{http.MethodTrace}}

// NewSettingsManifest describes an app's settings API: the app resource,
// served under the plugin ID, and the routes its proxy serves. It returns nil
// for a plugin that is not an app.
//
// The proxy routes are the ones an app manifest declares or, failing that,
// plugin.json's. plugin.json routes are matched in the order they are
// declared, and the settings API matches the most specific path, as it does
// any manifest route, so they are only included when every request they are
// probed with is forwarded the same way. When the routes are left out, err
// says why, and the settings API matches plugin.json's in the order they are
// declared.
func NewSettingsManifest(p PluginDefinition) (manifest *app.ManifestData, err error) {
	if p.JSONData.Type != plugins.TypeApp {
		return nil, nil
	}
	version := app.ManifestVersion{
		Name:   apppluginV0.VERSION,
		Served: true,
		Kinds:  []app.ManifestVersionKind{settingsKind},
	}
	manifest = &app.ManifestData{
		AppName:          p.JSONData.ID,
		Group:            p.JSONData.ID,
		PreferredVersion: apppluginV0.VERSION,
	}
	defer func() { manifest.Versions = []app.ManifestVersion{version} }()

	paths, declared, err := p.proxyRoutes()
	if err != nil || len(paths) == 0 {
		return manifest, err
	}
	if !declared {
		paths = withTrailingSlashes(paths)
	}
	routes := make(map[string]spec3.PathProps, len(paths))
	for path, props := range paths {
		routes[SettingsProxyRoot+path] = props
	}
	candidate := version
	candidate.OpenAPI.Paths = routes

	matched, err := settingsRouteMux(candidate)
	if err != nil {
		return manifest, err
	}
	if !declared {
		if err := verifyProxyRoutes(matched, p.JSONData.Routes); err != nil {
			return manifest, err
		}
	}
	version = candidate
	return manifest, nil
}

// LoadSettings sets p.Settings from p's plugin.json and manifests, which must
// already have their deprecated routes migrated. An error says why the proxy
// routes were left out of it; Settings is set regardless.
func (p *PluginDefinition) LoadSettings() error {
	settings, err := NewSettingsManifest(*p)
	p.Settings = settings
	return err
}

// ProxyRouteFor returns the plugin route a proxy route of the settings
// manifest forwards an operation with.
func ProxyRouteFor(route manifestroutes.Route, method string, op *spec3.Operation) (*plugins.Route, error) {
	rel := strings.TrimPrefix(route.Declared, SettingsProxyRoot)
	forwarded, ok, err := ProxyRouteFromOperation(rel, method, op)
	if err != nil {
		return nil, fmt.Errorf("%s %s: %w", method, route.Declared, err)
	}
	if !ok {
		return nil, fmt.Errorf("%s %s: a route below the proxy subresource must declare %s", method, route.Declared, ExtensionProxy)
	}
	return forwarded, nil
}

// withTrailingSlashes also declares each path that does not match the rest of
// the path with a trailing slash, which the plugin proxy matches too.
func withTrailingSlashes(paths map[string]spec3.PathProps) map[string]spec3.PathProps {
	out := make(map[string]spec3.PathProps, 2*len(paths))
	for path, props := range paths {
		out[path] = props
		if !strings.HasSuffix(path, ":*}") {
			out[path+"/"] = props
		}
	}
	return out
}

// IsTrailingSlashCopy reports whether a settings version path is the copy
// withTrailingSlashes declared for a plugin.json route, which is not published.
// A copy shares its operations with the path it copies; paths a manifest
// declares never do.
func IsTrailingSlashCopy(version app.ManifestVersion, path string) bool {
	trimmed, ok := strings.CutSuffix(path, "/")
	if !ok {
		return false
	}
	original, ok := version.OpenAPI.Paths[trimmed]
	if !ok {
		return false
	}
	copied := version.OpenAPI.Paths[path]
	ops := manifestroutes.Operations(&copied)
	for method, op := range manifestroutes.Operations(&original) {
		if ops[method] != op {
			return false
		}
	}
	return len(ops) > 0
}

// matchedRoute is the handler a probed route is registered with, so a match
// is told apart from the redirects and refusals ServeMux makes up.
type matchedRoute struct{ route *plugins.Route }

func (matchedRoute) ServeHTTP(http.ResponseWriter, *http.Request) {}

// settingsRouteMux registers a settings version's routes on a mux the way the
// settings API mounts them, relative to the version.
func settingsRouteMux(version app.ManifestVersion) (*http.ServeMux, error) {
	parsed, problems := manifestroutes.Parse(version, SettingsRouteOptions)
	if len(problems) > 0 {
		errs := make([]error, len(problems))
		for i, p := range problems {
			errs[i] = p
		}
		return nil, errors.Join(errs...)
	}
	mux := http.NewServeMux()
	for _, r := range parsed {
		for method, op := range manifestroutes.Operations(&r.Operations) {
			route, err := ProxyRouteFor(r, method, op)
			if err != nil {
				return nil, err
			}
			mux.Handle(method+" /"+r.Pattern, matchedRoute{route: route})
		}
	}
	return mux, nil
}

// verifyProxyRoutes checks that each probed request is forwarded with the same
// route settings, and the same remaining path, as the plugin proxy forwards it
// with the plugin.json routes. HEAD is not compared: it is answered as GET is,
// which is where app-sdk routes differ from the plugin proxy on purpose.
func verifyProxyRoutes(mux *http.ServeMux, legacy []*plugins.Route) error {
	root := strings.NewReplacer("{namespace}", "default", "{name}", apppluginV0.INSTANCE_NAME).Replace(SettingsProxyRoot) + "/"
	for _, probe := range proxyProbes(legacy) {
		for _, method := range proxyMethods {
			if method == http.MethodHead {
				continue
			}
			var matched []*plugins.Route
			h, _ := mux.Handler(&http.Request{Method: method, URL: &url.URL{Path: root + probe}})
			if m, ok := h.(matchedRoute); ok {
				route := *m.route
				route.Method = method
				matched = []*plugins.Route{&route}
			}

			want, wantPath, wantHasPath := plugins.MatchRoute(legacy, method, probe)
			got, gotPath, gotHasPath := plugins.MatchRoute(matched, method, probe)
			if !sameTarget(want, got) || wantPath != gotPath || wantHasPath != gotHasPath {
				return fmt.Errorf("%s %q would be forwarded with %s, not %s", method, probe, describeRoute(got), describeRoute(want))
			}
		}
	}
	return nil
}

// proxyProbes returns request paths that exercise each route and its
// neighbours: the route itself, with each parameter filled in, a trailing
// slash, longer paths below it, and its parent.
func proxyProbes(routes []*plugins.Route) []string {
	seen := map[string]bool{}
	var probes []string
	add := func(p string) {
		if !seen[p] {
			seen[p] = true
			probes = append(probes, p)
		}
	}
	add("")
	for _, route := range routes {
		if route == nil {
			continue
		}
		segments := strings.Split(strings.TrimSuffix(route.Path, "/"), "/")
		for i, segment := range segments {
			if segment == "*" || strings.HasPrefix(segment, ":") {
				segments[i] = "v"
			}
		}
		filled := strings.Join(segments, "/")
		add(filled)
		add(filled + "/")
		add(filled + "/v")
		add(filled + "/v/v")
		if i := strings.LastIndex(filled, "/"); i >= 0 {
			add(filled[:i])
		}
	}
	return probes
}

// sameTarget is whether a and b forward a request the same way, wherever they
// match.
func sameTarget(a, b *plugins.Route) bool {
	if a == nil || b == nil {
		return a == b
	}
	ac, bc := *a, *b
	ac.Path, ac.Method, bc.Path, bc.Method = "", "", "", ""
	return reflect.DeepEqual(ac, bc)
}

func describeRoute(route *plugins.Route) string {
	if route == nil {
		return "no route"
	}
	return fmt.Sprintf("route %q", route.Path)
}

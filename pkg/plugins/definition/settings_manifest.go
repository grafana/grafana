package definition

import (
	"errors"
	"fmt"
	"maps"
	"net/http"
	"net/url"
	"reflect"
	"slices"
	"strings"

	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	manifestroutes "github.com/grafana/grafana-app-sdk/routes"
	"github.com/grafana/grafana/pkg/plugins"
)

// The settings API's version, resource and the name of its one object. They
// are those of pkg/apis/appplugin/v0alpha1, which this module cannot import.
const (
	SettingsAPIVersion  = "v0alpha1"
	SettingsAPIResource = "app"
	SettingsAPIInstance = "instance"
)

// The settings manifest's version declares its routes below the settings
// object's subresources: the plugin's own resources, which it serves, and the
// routes its proxy forwards. Those are the only routes the settings API serves.
const (
	SettingsProxyRoot     = settingsObjectRoot + "/proxy"
	SettingsResourcesRoot = settingsObjectRoot + "/resources"

	settingsObjectRoot = "/namespaces/{namespace}/" + SettingsAPIResource + "/{name}"
	// settingsInstanceRoot is the settings object as an app manifest may
	// name it instead: by the URL it is served at.
	settingsInstanceRoot = "/namespaces/{namespace}/" + SettingsAPIResource + "/" + SettingsAPIInstance
)

// IsBelow reports whether path is root or below it.
func IsBelow(path, root string) bool {
	return path == root || strings.HasPrefix(path, root+"/")
}

// RouteMatcher matches a request against plugin.json routes as the plugin
// proxy does: the first route, in the order they are declared, that serves
// method and path. rest is what a final * in the route's path matched, and
// hasRest whether it has one.
type RouteMatcher func(routes []*plugins.Route, method, path string) (route *plugins.Route, rest string, hasRest bool)

// settingsKind is the kind the settings API serves its one object as. The
// object is always named instance, is not in a folder, and is not searchable.
func settingsKind() app.ManifestVersionKind {
	no := false
	return app.ManifestVersionKind{
		Kind:         "Settings",
		Plural:       "Settings",
		Resource:     SettingsAPIResource,
		Scope:        "Namespaced",
		FolderScoped: &no,
		FixedNames:   []string{SettingsAPIInstance},
		Search:       &app.ManifestVersionKindSearch{Endpoint: &no, Trash: &no},
	}
}

// SettingsRouteOptions are the rules the settings manifest's routes are parsed
// with, when it is loaded and when it is served.
var SettingsRouteOptions = manifestroutes.Options{UnservedMethods: []string{http.MethodTrace}}

// NewSettingsManifest describes an app's settings API: the app resource,
// served under the plugin ID, and the routes of its resources and proxy
// subresources. It returns nil for a plugin that is not an app.
//
// p.Settings, when set, is the foundation of the settings manifest: the app
// manifest whose group is the plugin ID, which describes the settings API
// rather than an API of its own. Its v0alpha1 version declares routes below
// the settings object's resources and proxy subresources, as /app/{name}/...
// or /app/instance/....
//
// When it declares no proxy routes, plugin.json's are used. plugin.json
// routes are matched in the order they are declared, and the settings API
// matches the most specific path, as it does any manifest route, so they are
// only included when every request they are probed with is forwarded the same
// way, as match decides; without match they are left out.
//
// err says what was left out of the manifest, which is returned regardless.
func NewSettingsManifest(p PluginDefinition, match RouteMatcher) (manifest *app.ManifestData, err error) {
	if p.JSONData.Type != plugins.TypeApp {
		return nil, nil
	}
	manifest = &app.ManifestData{AppName: p.JSONData.ID}
	if p.Settings != nil {
		*manifest = *p.Settings
	}
	manifest.Group = p.JSONData.ID
	manifest.PreferredVersion = SettingsAPIVersion

	version := app.ManifestVersion{
		Name:   SettingsAPIVersion,
		Served: true,
		Kinds:  []app.ManifestVersionKind{settingsKind()},
	}
	defer func() { manifest.Versions = []app.ManifestVersion{version} }()

	resources, proxy, components, errs := settingsRoutes(manifest)
	version.OpenAPI.Components = components
	if len(resources) > 0 {
		candidate := withPaths(version, resources)
		if _, err := settingsRouteMux(candidate); err != nil {
			errs = append(errs, fmt.Errorf("resource routes are left out: %w", err))
		} else {
			version = candidate
		}
	}

	declared := len(proxy) > 0
	if !declared {
		converted, err := ProxyRoutesToOpenAPI(p.JSONData.Routes)
		if err != nil {
			return manifest, errors.Join(append(errs, fmt.Errorf("proxy routes are left out: %w", err))...)
		}
		for path, props := range converted {
			proxy[SettingsProxyRoot+path] = props
		}
	}
	if len(proxy) == 0 {
		return manifest, errors.Join(errs...)
	}

	candidate := withPaths(version, proxy)
	matched, err := settingsRouteMux(candidate)
	if err == nil && !declared {
		if match == nil {
			err = errors.New("plugin.json routes cannot be checked without the plugin proxy's route matcher")
		} else {
			err = verifyProxyRoutes(matched, p.JSONData.Routes, match)
		}
	}
	if err != nil {
		return manifest, errors.Join(append(errs, fmt.Errorf("proxy routes are left out: %w", err))...)
	}
	version = candidate
	return manifest, errors.Join(errs...)
}

// settingsRoutes returns the resource and proxy routes the settings manifest's
// foundation declares, below the settings object as SettingsResourcesRoot and
// SettingsProxyRoot name it, and errors for what it declares that the settings
// API does not serve, with the components its routes may refer to.
func settingsRoutes(foundation *app.ManifestData) (resources, proxy map[string]spec3.PathProps, components app.ManifestVersionOpenAPIComponents, errs []error) {
	resources, proxy = map[string]spec3.PathProps{}, map[string]spec3.PathProps{}
	for _, version := range foundation.Versions {
		if version.Name != SettingsAPIVersion {
			if version.Served {
				errs = append(errs, fmt.Errorf("version %s is not served: the settings API serves only %s", version.Name, SettingsAPIVersion))
			}
			continue
		}
		components = version.OpenAPI.Components
		for path, props := range version.OpenAPI.Paths {
			if rest, ok := strings.CutPrefix(path, settingsInstanceRoot); ok && (rest == "" || rest[0] == '/') {
				path = settingsObjectRoot + rest
			}
			switch {
			case IsBelow(path, SettingsProxyRoot):
				proxy[path] = props
			case IsBelow(path, SettingsResourcesRoot):
				for method, op := range manifestroutes.Operations(&props) {
					if _, ok := op.Extensions[ExtensionProxy]; ok {
						errs = append(errs, fmt.Errorf("%s %s: %s is only served below the proxy subresource", method, path, ExtensionProxy))
						props = WithoutProxyExtension(props)
						break
					}
				}
				resources[path] = props
			default:
				errs = append(errs, fmt.Errorf("%s is not served: the settings API serves routes only below its resources and proxy subresources", path))
			}
		}
	}
	return resources, proxy, components, errs
}

// withPaths returns version with paths added to its OpenAPI paths.
func withPaths(version app.ManifestVersion, paths map[string]spec3.PathProps) app.ManifestVersion {
	merged := make(map[string]spec3.PathProps, len(version.OpenAPI.Paths)+len(paths))
	maps.Copy(merged, version.OpenAPI.Paths)
	maps.Copy(merged, paths)
	version.OpenAPI.Paths = merged
	return version
}

// LoadSettings sets p.Settings from p's plugin.json and the settings manifest
// it was loaded with, which must already have its deprecated routes migrated;
// see NewSettingsManifest. An error says what was left out of it; Settings is
// set regardless.
func (p *PluginDefinition) LoadSettings(match RouteMatcher) error {
	settings, err := NewSettingsManifest(*p, match)
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

// WithTrailingSlashes returns routes with a copy of each proxy route that does
// not match the rest of the path, which matches its path with a trailing
// slash, as the plugin proxy does. A copy keeps the route's Declared path, so it
// is served and published as that route. A path a route already matches is not
// copied, nor is a copy that would conflict with another route: routes are
// mounted on a ServeMux, which panics on a conflict, and manifestroutes.Parse
// only checked the declared routes.
func WithTrailingSlashes(routes []manifestroutes.Route) []manifestroutes.Route {
	scratch := http.NewServeMux()
	for _, r := range routes {
		_ = registers(scratch, r)
	}
	out := slices.Clone(routes)
	for _, r := range routes {
		if !IsBelow(r.Declared, SettingsProxyRoot) || strings.HasSuffix(r.Pattern, "...}") || strings.HasSuffix(r.Pattern, "{$}") {
			continue
		}
		copied := r
		copied.Pattern += "/{$}"
		if registers(scratch, copied) {
			out = append(out, copied)
		}
	}
	return out
}

// registers registers r's operations on mux, reporting false if one conflicts
// with a pattern already registered, or is one.
func registers(mux *http.ServeMux, r manifestroutes.Route) (ok bool) {
	defer func() {
		if recover() != nil {
			ok = false
		}
	}()
	for method := range manifestroutes.Operations(&r.Operations) {
		mux.Handle(method+" /"+r.Pattern, http.NotFoundHandler())
	}
	return true
}

// matchedRoute is the handler a probed route is registered with, so a match
// is told apart from the redirects and refusals ServeMux makes up.
type matchedRoute struct{ route *plugins.Route }

func (matchedRoute) ServeHTTP(http.ResponseWriter, *http.Request) {}

// settingsRouteMux parses a settings version's routes, and registers its
// proxy routes on a mux the way the settings API mounts them, relative to the
// version.
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
	for _, r := range WithTrailingSlashes(parsed) {
		if !IsBelow(r.Declared, SettingsProxyRoot) {
			continue
		}
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
func verifyProxyRoutes(mux *http.ServeMux, legacy []*plugins.Route, match RouteMatcher) error {
	root := strings.NewReplacer("{namespace}", "default", "{name}", SettingsAPIInstance).Replace(SettingsProxyRoot) + "/"
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

			want, wantPath, wantHasPath := match(legacy, method, probe)
			got, gotPath, gotHasPath := match(matched, method, probe)
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
		// A request path below the proxy root has no leading slash.
		segments := strings.Split(strings.TrimSuffix(strings.TrimPrefix(route.Path, "/"), "/"), "/")
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

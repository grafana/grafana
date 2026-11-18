package appsettings

import (
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	manifestroutes "github.com/grafana/grafana-app-sdk/routes"
	"github.com/grafana/grafana/pkg/api/pluginproxy"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute/routemux"
)

var logger = log.New("plugins.appsettings")

// settingsProxyRoot is where the proxy routes mount in the settings version:
// below the proxy subresource of the settings object.
const settingsProxyRoot = "/namespaces/{namespace}/" + apppluginV0.APP_RESOURCE_NAME + "/{name}/proxy"

// proxyRoutes are the proxy routes, declared as the settings version's OpenAPI
// paths and served through routemux, as a manifest version's routes are.
type proxyRoutes struct {
	version routemux.Version

	// routes holds each route's plugin route by method, by its declared path.
	routes map[string]map[string]*plugins.Route

	// paths are the routes' OpenAPI paths relative to the proxy subresource,
	// without what they forward to, for publishing.
	paths map[string]spec3.PathProps
}

// compileProxyRoutes resolves the proxy routes the plugin declares in an app
// manifest or, failing that, in plugin.json. Converted plugin.json routes are
// only used when every request they are probed with is forwarded as the plugin
// proxy forwards it.
func compileProxyRoutes(group string, plugin definition.PluginDefinition) (*proxyRoutes, error) {
	paths, declared, err := plugin.ProxyRoutes()
	if err != nil {
		return nil, err
	}
	if len(paths) == 0 {
		return nil, nil
	}
	if !declared {
		paths = withTrailingSlashes(paths)
	}

	versionPaths := make(map[string]spec3.PathProps, len(paths))
	for path, props := range paths {
		versionPaths[settingsProxyRoot+path] = props
	}
	parsed, problems := manifestroutes.Parse(app.ManifestVersion{
		Name:   apppluginV0.VERSION,
		Served: true,
		Kinds: []app.ManifestVersionKind{{
			Kind:     "Settings",
			Plural:   "Settings",
			Resource: apppluginV0.APP_RESOURCE_NAME,
			Scope:    "Namespaced",
		}},
		OpenAPI: app.ManifestVersionOpenAPI{Paths: versionPaths},
	}, manifestroutes.Options{UnservedMethods: []string{http.MethodTrace}})
	if len(problems) > 0 {
		errs := make([]error, len(problems))
		for i, p := range problems {
			errs[i] = p
		}
		return nil, errors.Join(errs...)
	}

	compiled := &proxyRoutes{
		version: routemux.Version{Name: apppluginV0.VERSION, Routes: parsed},
		routes:  map[string]map[string]*plugins.Route{},
		paths:   map[string]spec3.PathProps{},
	}
	for _, r := range parsed {
		rel := strings.TrimPrefix(r.Declared, settingsProxyRoot)
		byMethod := map[string]*plugins.Route{}
		for method, op := range manifestroutes.Operations(&r.Operations) {
			route, ok, err := definition.ProxyRouteFromOperation(rel, method, op)
			if err != nil {
				return nil, fmt.Errorf("%s %s: %w", method, r.Declared, err)
			}
			if !ok {
				return nil, fmt.Errorf("%s %s: a route below the proxy subresource must declare %s", method, r.Declared, definition.ExtensionProxy)
			}
			byMethod[method] = route
		}
		compiled.routes[r.Declared] = byMethod
		if !declared && strings.HasSuffix(rel, "/") {
			continue // the copy withTrailingSlashes added is not published
		}
		compiled.paths[strings.TrimPrefix(r.SpecPath, strings.TrimPrefix(settingsProxyRoot, "/")+"/")] = definition.WithoutProxyExtension(r.Operations)
	}

	if !declared {
		if err := compiled.verify(group, plugin.JSONData.Routes); err != nil {
			return nil, err
		}
	}
	return compiled, nil
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

// routeFor returns the plugin route a request is forwarded with. ServeMux
// answers HEAD with a GET route, and the plugin proxy only uses a route for the
// method it names, so the route is given the request's method.
func (p *proxyRoutes) routeFor(route manifestroutes.Route, method string) *plugins.Route {
	byMethod := p.routes[route.Declared]
	matched := byMethod[method]
	if matched == nil && method == http.MethodHead {
		matched = byMethod[http.MethodGet]
	}
	if matched == nil {
		return nil
	}
	r := *matched
	r.Method = method
	return &r
}

// handler serves each route through serve, with the one route it matched.
func (p *proxyRoutes) handler(serve func(http.ResponseWriter, *http.Request, []*plugins.Route)) routemux.HandlerFunc {
	return func(_ schema.GroupVersion, route manifestroutes.Route) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var routes []*plugins.Route
			if matched := p.routeFor(route, r.Method); matched != nil {
				routes = []*plugins.Route{matched}
			}
			serve(w, r, routes)
		})
	}
}

// verify checks, through the mux the routes are served with, that each probed
// request is forwarded with the same route settings and the same remaining
// path as the plugin proxy forwards it with the plugin.json routes. HEAD is not
// compared: it is answered as GET is, which is where app-sdk routes differ from
// the plugin proxy on purpose.
func (p *proxyRoutes) verify(group string, legacy []*plugins.Route) error {
	var matched []*plugins.Route
	mux := routemux.Wrap(group, []routemux.Version{p.version}, p.handler(
		func(_ http.ResponseWriter, _ *http.Request, routes []*plugins.Route) { matched = routes },
	), http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}), nil)

	root := "/apis/" + group + "/" + apppluginV0.VERSION + "/namespaces/default/" +
		apppluginV0.APP_RESOURCE_NAME + "/" + apppluginV0.INSTANCE_NAME + "/proxy/"
	for _, probe := range proxyProbes(legacy) {
		for _, method := range forwardedMethods {
			if method == http.MethodHead {
				continue
			}
			req, err := http.NewRequest(method, root+probe, nil)
			if err != nil {
				return err
			}
			matched = nil
			mux.ServeHTTP(discard{}, req)

			want, wantPath, wantHasPath := pluginproxy.MatchRoute(legacy, method, probe)
			got, gotPath, gotHasPath := pluginproxy.MatchRoute(matched, method, probe)
			if !sameTarget(want, got) || wantPath != gotPath || wantHasPath != gotHasPath {
				return fmt.Errorf("%s %q would be forwarded with %s, not %s", method, probe, describeRoute(got), describeRoute(want))
			}
		}
	}
	return nil
}

// discard is the response writer probes are served with. Only which route a
// probe reaches matters.
type discard struct{}

func (discard) Header() http.Header         { return http.Header{} }
func (discard) Write(b []byte) (int, error) { return len(b), nil }
func (discard) WriteHeader(int)             {}

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

package appsettings

import (
	"errors"
	"net/http"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	manifestroutes "github.com/grafana/grafana-app-sdk/routes"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute/routemux"
)

var logger = log.New("plugins.appsettings")

// proxyRoutes are the proxy routes the settings manifest declares, served
// through routemux, as a manifest version's routes are.
type proxyRoutes struct {
	version routemux.Version

	// routes holds each route's plugin route by method, by its declared path.
	routes map[string]map[string]*plugins.Route

	// paths are the routes' OpenAPI paths relative to the proxy subresource,
	// without what they forward to, for publishing.
	paths map[string]spec3.PathProps
}

// compileProxyRoutes resolves the proxy routes of a settings manifest
// (definition.NewSettingsManifest), or returns nil when it declares none.
func compileProxyRoutes(settings *app.ManifestData) (*proxyRoutes, error) {
	if settings == nil {
		return nil, nil
	}
	idx := -1
	for i, v := range settings.Versions {
		if v.Name == apppluginV0.VERSION && v.Served {
			idx = i
		}
	}
	if idx < 0 || len(settings.Versions[idx].OpenAPI.Paths) == 0 {
		return nil, nil
	}
	version := settings.Versions[idx]

	parsed, problems := manifestroutes.Parse(version, definition.SettingsRouteOptions)
	if len(problems) > 0 {
		errs := make([]error, len(problems))
		for i, p := range problems {
			errs[i] = p
		}
		return nil, errors.Join(errs...)
	}

	compiled := &proxyRoutes{
		version: routemux.Version{Name: version.Name, Routes: parsed},
		routes:  map[string]map[string]*plugins.Route{},
		paths:   map[string]spec3.PathProps{},
	}
	published := strings.TrimPrefix(definition.SettingsProxyRoot, "/") + "/"
	for _, r := range parsed {
		byMethod := map[string]*plugins.Route{}
		for method, op := range manifestroutes.Operations(&r.Operations) {
			route, err := definition.ProxyRouteFor(r, method, op)
			if err != nil {
				return nil, err
			}
			byMethod[method] = route
		}
		compiled.routes[r.Declared] = byMethod
		if definition.IsTrailingSlashCopy(version, r.Declared) {
			continue
		}
		compiled.paths[strings.TrimPrefix(r.SpecPath, published)] = definition.WithoutProxyExtension(r.Operations)
	}
	return compiled, nil
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

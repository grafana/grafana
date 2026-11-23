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

// settingsRoutes are the routes the settings manifest declares below the
// settings object (definition.NewSettingsManifest).
type settingsRoutes struct {
	// proxy are the proxy subresource's routes, or nil when it has none.
	proxy *proxyRoutes

	// resources are the resources subresource's routes, relative to it, for
	// publishing. The plugin serves its resources, so every request is passed
	// on, not only those of these routes.
	resources map[string]spec3.PathProps

	// components are the schemas, responses and examples the routes refer to.
	components app.ManifestVersionOpenAPIComponents
}

// proxyRoutes are the proxy routes of the settings manifest, served through
// routemux, as a manifest version's routes are.
type proxyRoutes struct {
	version routemux.Version

	// routes holds each route's plugin route by method, by its declared path.
	routes map[string]map[string]*plugins.Route

	// paths are the routes' OpenAPI paths relative to the proxy subresource,
	// without what they forward to, for publishing.
	paths map[string]spec3.PathProps
}

// compileSettingsRoutes resolves the routes of a settings manifest.
func compileSettingsRoutes(settings *app.ManifestData) (*settingsRoutes, error) {
	compiled := &settingsRoutes{resources: map[string]spec3.PathProps{}}
	if settings == nil {
		return compiled, nil
	}
	idx := -1
	for i, v := range settings.Versions {
		if v.Name == apppluginV0.VERSION && v.Served {
			idx = i
		}
	}
	if idx < 0 || len(settings.Versions[idx].OpenAPI.Paths) == 0 {
		return compiled, nil
	}
	version := settings.Versions[idx]
	compiled.components = version.OpenAPI.Components

	parsed, problems := manifestroutes.Parse(version, definition.SettingsRouteOptions)
	if len(problems) > 0 {
		errs := make([]error, len(problems))
		for i, p := range problems {
			errs[i] = p
		}
		return nil, errors.Join(errs...)
	}

	proxy := &proxyRoutes{
		routes: map[string]map[string]*plugins.Route{},
		paths:  map[string]spec3.PathProps{},
	}
	var proxied []manifestroutes.Route
	for _, r := range parsed {
		switch {
		case definition.IsBelow(r.Declared, definition.SettingsResourcesRoot):
			compiled.resources[relativeSpecPath(r.SpecPath, definition.SettingsResourcesRoot)] = r.Operations
		case definition.IsBelow(r.Declared, definition.SettingsProxyRoot):
			byMethod := map[string]*plugins.Route{}
			for method, op := range manifestroutes.Operations(&r.Operations) {
				route, err := definition.ProxyRouteFor(r, method, op)
				if err != nil {
					return nil, err
				}
				byMethod[method] = route
			}
			proxy.routes[r.Declared] = byMethod
			proxied = append(proxied, r)
			proxy.paths[relativeSpecPath(r.SpecPath, definition.SettingsProxyRoot)] = definition.WithoutProxyExtension(r.Operations)
		}
	}
	if len(proxied) > 0 {
		proxy.version = routemux.Version{Name: version.Name, Routes: definition.WithTrailingSlashes(proxied)}
		compiled.proxy = proxy
	}
	return compiled, nil
}

// relativeSpecPath returns a route's published path below a subresource root.
func relativeSpecPath(specPath, root string) string {
	rest := strings.TrimPrefix(specPath, strings.TrimPrefix(root, "/"))
	return strings.TrimPrefix(rest, "/")
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

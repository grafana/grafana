package pluginroute

import (
	"encoding/json"
	"errors"
	"maps"
	"net/http"
	"slices"
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana-app-sdk/plugin/httpadapter"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/keysroutes"
	"github.com/grafana/grafana/pkg/services/apiserver/kindstore"
	"github.com/grafana/grafana/pkg/services/apiserver/searchroutes"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute/manifestroutes"
	"github.com/grafana/grafana/pkg/util/errhttp"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

const (
	namespaceParameter = manifestroutes.NamespaceParameter
	nameParameter      = manifestroutes.NameParameter
)

// routeOptions are the parts of the manifest route rules that depend on this
// server. The settings resource is served in every version. TRACE echoes the
// request back, and OPTIONS is answered 405 like any other undeclared method.
var routeOptions = manifestroutes.Options{
	ReservedResources: []string{apppluginV0.APP_RESOURCE_NAME},
	UnservedMethods:   []string{http.MethodTrace, http.MethodOptions},
}

// GetAPIRoutes returns the generic search and keys routes the apiserver mounts
// for this version's kinds. The manifest's own routes are served by routeMux.
func (b *manifestBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	if b.servedVersion(gv) == nil {
		return nil
	}

	routes := &builder.APIRoutes{}

	// A manifest whose search declarations cannot be read cannot be searched, but
	// the rest of its API still works, so this drops search rather than the group.
	searchHandlers, err := b.searchRoutes(gv)
	if err != nil {
		logging.DefaultLogger.Error("invalid manifest search declarations; search, trash and hybrid routes are not served",
			"group", gv.Group, "version", gv.Version, "error", err)
	}
	routes.Namespace = append(routes.Namespace, searchHandlers...)

	if keys := b.keysRoutes(gv); keys != nil {
		routes.Root = append(routes.Root, keys.Root...)
		routes.Namespace = append(routes.Namespace, keys.Namespace...)
	}

	if !hasRoutes(routes) {
		return nil
	}
	return routes
}

func (b *manifestBuilder) servedVersion(gv schema.GroupVersion) *app.ManifestVersion {
	if b.manifest == nil {
		return nil
	}
	for i, version := range b.manifest.Versions {
		if version.Name == gv.Version && version.Served {
			return &b.manifest.Versions[i]
		}
	}
	return nil
}

// versionRoutes returns the custom routes a served version mounts. skip is
// told about each declared path, or method, that is not mounted.
func (b *manifestBuilder) versionRoutes(gv schema.GroupVersion, skip func(manifestroutes.Problem)) []manifestroutes.Route {
	version := b.servedVersion(gv)
	if version == nil {
		return nil
	}
	return parseManifestRoutes(*version, skip)
}

// parseManifestRoutes resolves a version's custom routes, from its OpenAPI paths
// or, for an older manifest, its deprecated routes.
func parseManifestRoutes(version app.ManifestVersion, skip func(manifestroutes.Problem)) []manifestroutes.Route {
	version.OpenAPI = versionOpenAPI(version)
	routes, problems := manifestroutes.Parse(version, routeOptions)
	for _, p := range problems {
		skip(p)
	}
	return routes
}

func ignoreSkipped(manifestroutes.Problem) {}

// routeMux serves the manifest's custom routes and hands every other request
// to next. It wraps the apiserver's handler, inside the filter chain, so a
// request reaching a route has already been authenticated and authorized.
func (b *manifestBuilder) routeMux(next http.Handler, reg prometheus.Registerer) http.Handler {
	if b.manifest == nil {
		return next
	}
	metrics := builder.NewCustomRouteMetrics(reg)
	mux := http.NewServeMux()
	mounted := 0
	for _, version := range b.manifest.Versions {
		if !version.Served {
			continue
		}
		gv := schema.GroupVersion{Group: b.group, Version: version.Name}
		warn := func(p manifestroutes.Problem) {
			logging.DefaultLogger.Warn("skipping manifest route",
				"group", gv.Group, "version", gv.Version, "path", p.Path, "method", p.Method, "reason", p.Reason)
		}
		// manifestroutes.Parse has already registered every pattern on a scratch
		// mux, so registering them again cannot fail.
		root := "/apis/" + gv.String() + "/"
		for _, route := range b.versionRoutes(gv, warn) {
			handler := metrics.InstrumentHandler(gv.Group, gv.Version, route.Path, b.routeHandler(gv, route))
			for method := range manifestroutes.Operations(&route.Operations) {
				mux.Handle(method+" "+root+route.Pattern, handler)
				mounted++
			}
		}
	}
	if mounted == 0 {
		return next
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Not mux.Handle("/", next): the mux would also clean and redirect paths
		// meant for the apiserver.
		if _, pattern := mux.Handler(r); pattern != "" {
			mux.ServeHTTP(w, r)
			return
		}
		// The path is the plugin's, since paths the apiserver serves are never
		// mounted, so an undeclared method is refused here rather than passed on
		// to answer 404.
		if allowed := allowedMethods(mux, r); len(allowed) > 0 {
			methodNotAllowed(w, r, allowed)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// servedMethods are the methods a manifest route can be mounted for. HEAD is
// matched by a GET pattern too.
var servedMethods = []string{
	http.MethodDelete, http.MethodGet, http.MethodHead,
	http.MethodPatch, http.MethodPost, http.MethodPut,
}

// allowedMethods returns the methods mux serves for r's path, the same lookup
// ServeMux makes for its own 405s. Registering a method-less pattern per path
// instead would conflict with another route's wildcard.
func allowedMethods(mux *http.ServeMux, r *http.Request) []string {
	var allowed []string
	// A shallow copy is enough to look up a route, and this runs for every
	// request the apiserver serves, so the headers are not cloned.
	probe := *r
	for _, method := range servedMethods {
		probe.Method = method
		if _, pattern := mux.Handler(&probe); pattern != "" {
			allowed = append(allowed, method)
		}
	}
	return allowed
}

// methodNotAllowed answers a method the route does not declare, listing the
// ones it does.
func methodNotAllowed(w http.ResponseWriter, r *http.Request, allowed []string) {
	w.Header().Set("Allow", strings.Join(allowed, ", "))
	// Not apierrors.NewMethodNotSupported, which names a resource kind that a
	// custom route does not have.
	_ = errhttp.Write(r.Context(), &apierrors.StatusError{ErrStatus: metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusMethodNotAllowed,
		Reason:  metav1.StatusReasonMethodNotAllowed,
		Message: r.Method + " is not supported",
	}}, w)
}

// routeSpec documents the path segments a route is mounted under.
func routeSpec(route manifestroutes.Route) *spec3.PathProps {
	var params []*spec3.Parameter
	if route.Namespaced {
		params = append(params, namespacePathParameter())
	}
	if route.Kind == nil {
		return withPathParameters(route.Operations, nil, params...)
	}
	return withPathParameters(route.Operations, []string{route.Kind.Kind}, append(params, namePathParameter())...)
}

// versionOpenAPI returns the custom routes a version declares. Manifests built
// before app-sdk published routes as OpenAPI paths only carry the deprecated
// Routes, so those are converted to paths the way app-sdk codegen does.
func versionOpenAPI(version app.ManifestVersion) app.ManifestVersionOpenAPI {
	out := version.OpenAPI
	if len(out.Paths) > 0 {
		return out
	}

	legacy := version.Routes //nolint:staticcheck // SA1019: Keep serving routes from legacy plugin manifests.
	paths := map[string]spec3.PathProps{}
	add := func(prefix string, routes map[string]spec3.PathProps) {
		for path, props := range routes {
			paths[prefix+"/"+strings.TrimPrefix(path, "/")] = props
		}
	}
	add("", legacy.Cluster)
	add("/"+manifestroutes.NamespacedPrefix, legacy.Namespaced)
	for _, kind := range version.Kinds {
		prefix := "/" + strings.ToLower(kind.Plural) + "/{" + nameParameter + "}"
		if kind.Scope != kindstore.ClusterScope {
			prefix = "/" + manifestroutes.NamespacedPrefix + prefix
		}
		add(prefix, kind.Routes)
	}
	out.Paths = paths

	if len(legacy.Schemas) > 0 {
		schemas := maps.Clone(legacy.Schemas)
		// Schemas declared in the OpenAPI section win over the legacy copies.
		maps.Copy(schemas, out.Components.Schemas)
		out.Components.Schemas = schemas
	}
	return out
}

// searchRoutes builds the generic search, trash and hybrid endpoints for the kinds this
// version serves.
//
// Delegated to searchroutes rather than mounted per kind here, because which
// kinds get these endpoints is not a decision this builder should be making on
// its own: the same manifest served as a custom resource definition goes through
// the same package, and a kind that is searchable one way must be searchable the
// other. That is where the eligibility rules and each kind's opt-out are applied.
func (b *manifestBuilder) searchRoutes(gv schema.GroupVersion) ([]builder.APIRouteHandler, error) {
	if b.search == nil {
		return nil, nil
	}

	manifest := *b.manifest
	manifest.Group = b.group
	built, err := searchroutes.BuildForServedGroupVersions(
		[]*app.ManifestData{&manifest},
		map[schema.GroupVersion]bool{gv: true},
		true,
		true,
		b.tracer,
		b.search,
		searchroutes.Options{HybridEnabled: b.opts.HybridAPIEnabled},
	)
	if err != nil {
		return nil, err
	}

	var handlers []builder.APIRouteHandler
	for _, gvRoutes := range built {
		if gvRoutes.GroupVersion != gv || gvRoutes.Routes == nil {
			continue
		}
		handlers = append(handlers, gvRoutes.Routes.Namespace...)
	}
	return handlers, nil
}

// keysRoutes builds the generic list-keys endpoints for the kinds this version
// serves, at both scopes.
//
// Delegated to keysroutes for the same reason as searchRoutes: which kinds get
// the endpoint is not a decision this builder should be making on its own, so the
// config toggle and the namespaced-kind rule are applied in one place and a
// plugin-served manifest agrees with the same manifest served as a custom
// resource definition.
func (b *manifestBuilder) keysRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	if b.store == nil {
		return nil
	}

	manifest := *b.manifest
	manifest.Group = b.group
	built := keysroutes.BuildForServedGroupVersions(
		[]*app.ManifestData{&manifest},
		map[schema.GroupVersion]bool{gv: true},
		b.opts.KeysAPIEnabled,
		b.tracer,
		b.store,
	)

	// One manifest and one served version in, so at most one entry matches.
	for _, gvRoutes := range built {
		if gvRoutes.GroupVersion == gv {
			return gvRoutes.Routes
		}
	}
	return nil
}

// routeHandler forwards a manifest route to the plugin's v3 route service. A
// kind subresource route also carries the parent object, named by the path.
func (b *manifestBuilder) routeHandler(gv schema.GroupVersion, route manifestroutes.Route) http.HandlerFunc {
	path, resource := route.Path, ""
	if route.Kind != nil {
		path, resource = route.Subresource, strings.ToLower(route.Kind.Plural)
	}
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		if route.Namespaced {
			// Read by the plugin's route info and by the storage lookup below.
			ctx = request.WithNamespace(ctx, r.PathValue(namespaceParameter))
			r = r.WithContext(ctx)
		}

		// Without this the plugin only sees the raw URL, and no group, version,
		// namespace or parent object. Path is the declared route, not the one it
		// was called with, because app-sdk's simple.App finds handlers by exact
		// declared path; the request URL still carries the concrete one.
		info := httpadapter.RouteInfo{
			Group:     gv.Group,
			Version:   gv.Version,
			Namespace: request.NamespaceValue(ctx),
			Path:      path,
		}

		if resource != "" {
			parent := &pluginv3.RouteResource{}
			parent.SetResource(resource)

			if name := r.PathValue(nameParameter); name != "" {
				// The getter is wired in UpdateAPIGroupInfo; a route that somehow
				// serves before then must not panic on the request path.
				if b.getter == nil {
					_ = errhttp.Write(ctx, apierrors.NewInternalError(
						errors.New("plugin storage is not ready")), w)
					return
				}
				// Unified storage will apply the resource level access control
				obj, err := b.getter(ctx, gv.WithResource(resource), name)
				if err != nil {
					_ = errhttp.Write(ctx, err, w)
					return
				}
				m, err := utils.MetaAccessor(obj)
				if err != nil {
					_ = errhttp.Write(ctx, err, w)
					return
				}
				raw, err := json.Marshal(obj)
				if err != nil {
					_ = errhttp.Write(ctx, err, w)
					return
				}

				sv, err := b.decrypter.get(ctx, m)
				if err != nil {
					_ = errhttp.Write(ctx, err, w)
					return
				}
				parent.SetName(name)
				parent.SetRv(m.GetResourceVersion())
				parent.SetRaw(raw)
				parent.SetDecryptedSecureValues(sv)
			}
			info.Parent = parent
		}
		req := r.Clone(httpadapter.WithRouteInfo(ctx, info))
		// The caller's identity reaches the plugin only as the access token the
		// v3 client exchanges for it, never as an ID token in the HTTP headers.
		req.Header.Del(proxyutil.IDHeaderName)
		httpadapter.HandlerFunc(b.clientV3).ServeHTTP(w, req)
	}
}

// namespacePathParameter documents the {namespace} segment that namespaced
// routes mount under.
func namespacePathParameter() *spec3.Parameter {
	return &spec3.Parameter{
		ParameterProps: spec3.ParameterProps{
			Name:        namespaceParameter,
			In:          "path",
			Required:    true,
			Example:     "default",
			Description: "workspace",
			Schema:      spec.StringProperty(),
		},
	}
}

// namePathParameter documents the {name} segment that kind routes mount under.
func namePathParameter() *spec3.Parameter {
	return &spec3.Parameter{
		ParameterProps: spec3.ParameterProps{
			Name:        nameParameter,
			In:          "path",
			Required:    true,
			Description: "name of the parent resource",
			Schema:      spec.StringProperty(),
		},
	}
}

// withPathParameters documents the path segments a route is mounted under, since
// a path parameter missing from the spec makes the operation invalid. The
// operations are copied because they are shared with the loaded manifest.
func withPathParameters(props spec3.PathProps, tags []string, params ...*spec3.Parameter) *spec3.PathProps {
	out := props
	for _, op := range []**spec3.Operation{
		&out.Get, &out.Head, &out.Delete, &out.Post,
		&out.Put, &out.Patch, &out.Trace, &out.Options,
	} {
		if *op == nil {
			continue
		}
		*op = operationWithPathParameters(**op, tags, params...)
	}
	return &out
}

func operationWithPathParameters(op spec3.Operation, tags []string, params ...*spec3.Parameter) *spec3.Operation {
	// Each operation gets its own copy so the spec has no aliased parameters.
	declared := slices.Clone(op.Parameters)
	for _, param := range params {
		if slices.ContainsFunc(declared, func(p *spec3.Parameter) bool {
			return p != nil && p.Name == param.Name && p.In == "path"
		}) {
			continue
		}
		p := *param
		declared = append(declared, &p)
	}
	op.Parameters = declared
	if tags != nil {
		op.Tags = slices.Clone(tags)
	}
	return &op
}

package pluginroute

import (
	"encoding/json"
	"errors"
	"fmt"
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
	"github.com/grafana/grafana/pkg/util/errhttp"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

const (
	// namespaceParameter is the path parameter carrying the namespace on routes
	// mounted under /namespaces/{namespace}.
	namespaceParameter = "namespace"

	// nameParameter is the path parameter carrying the parent object's name on a
	// kind subresource route.
	nameParameter = "name"
)

// reservedSubresources are served by the kind store itself, so a manifest kind
// route may not claim them.
var reservedSubresources = map[string]bool{"status": true}

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
// told about each declared path that is not mounted.
func (b *manifestBuilder) versionRoutes(gv schema.GroupVersion, skip func(path, reason string)) []manifestRoute {
	version := b.servedVersion(gv)
	if version == nil {
		return nil
	}
	return parseManifestRoutes(*version, skip)
}

func ignoreSkipped(string, string) {}

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
		warn := func(path, reason string) {
			logging.DefaultLogger.Warn("skipping manifest route",
				"group", gv.Group, "version", gv.Version, "path", path, "reason", reason)
		}
		for _, route := range b.versionRoutes(gv, warn) {
			handler := metrics.InstrumentHandler(gv.Group, gv.Version, route.path, b.routeHandler(gv, route))
			pattern := "/apis/" + gv.String() + "/" + route.versionPath()
			if strings.HasSuffix(pattern, "/") {
				pattern += "{$}" // otherwise the pattern matches the whole subtree
			}
			var allowed []string
			for method := range builder.GetPathOperations(&route.props) {
				if err := handle(mux, method+" "+pattern, handler); err != nil {
					warn(route.versionPath(), err.Error())
					continue
				}
				allowed = append(allowed, method)
				mounted++
			}
			if len(allowed) == 0 {
				continue
			}
			// The path is the plugin's, since paths the apiserver serves are never
			// mounted, so an undeclared method is refused here rather than passed
			// on to answer 404.
			if err := handle(mux, pattern, methodNotAllowed(allowed)); err != nil {
				warn(route.versionPath(), err.Error())
			}
		}
	}
	if mounted == 0 {
		return next
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Not mux.Handle("/", next): the mux would also clean and redirect paths
		// meant for the apiserver, and answer 405 for its own paths that the
		// apiserver might still serve.
		if _, pattern := mux.Handler(r); pattern != "" {
			mux.ServeHTTP(w, r)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// methodNotAllowed answers a method the route does not declare, listing the
// ones it does.
func methodNotAllowed(allowed []string) http.HandlerFunc {
	// A GET pattern also serves HEAD.
	if slices.Contains(allowed, http.MethodGet) && !slices.Contains(allowed, http.MethodHead) {
		allowed = append(allowed, http.MethodHead)
	}
	slices.Sort(allowed)
	header := strings.Join(allowed, ", ")
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Allow", header)
		// Not apierrors.NewMethodNotSupported, which names a resource kind that a
		// custom route does not have.
		_ = errhttp.Write(r.Context(), &apierrors.StatusError{ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    http.StatusMethodNotAllowed,
			Reason:  metav1.StatusReasonMethodNotAllowed,
			Message: r.Method + " is not supported",
		}}, w)
	}
}

// handle registers a pattern, returning the error ServeMux panics with for an
// invalid or conflicting one, so one bad manifest path does not fail the plugin.
func handle(mux *http.ServeMux, pattern string, handler http.Handler) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("invalid route pattern %q: %v", pattern, r)
		}
	}()
	mux.Handle(pattern, handler)
	return nil
}

// manifestRoute is one path of a version's OpenAPI, resolved to where it mounts.
type manifestRoute struct {
	// path is relative to the mount point: the group version root, or
	// namespaces/{namespace} when namespaced.
	path       string
	namespaced bool
	props      spec3.PathProps

	// kind is set for a subresource route of a single object, with subresource
	// the part of the path below {name}.
	kind        *app.ManifestVersionKind
	subresource string
}

// versionPath is the route's path relative to the group version root.
func (r manifestRoute) versionPath() string {
	if r.namespaced {
		return namespacedPrefix + "/" + r.path
	}
	return r.path
}

// spec documents the path segments the route is mounted under.
func (r manifestRoute) spec() *spec3.PathProps {
	var params []*spec3.Parameter
	if r.namespaced {
		params = append(params, namespacePathParameter())
	}
	if r.kind == nil {
		return withPathParameters(r.props, nil, params...)
	}
	return withPathParameters(r.props, []string{r.kind.Kind}, append(params, namePathParameter())...)
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
	add("/"+namespacedPrefix, legacy.Namespaced)
	for _, kind := range version.Kinds {
		prefix := "/" + strings.ToLower(kind.Plural) + "/{" + nameParameter + "}"
		if kind.Scope != kindstore.ClusterScope {
			prefix = "/" + namespacedPrefix + prefix
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

// namespacedPrefix is the version-relative path namespaced routes mount under.
const namespacedPrefix = "namespaces/{" + namespaceParameter + "}"

// withoutUnservedMethods removes the operations routeMux does not serve, so they
// are answered 405 and left out of the spec. TRACE echoes the request back,
// and OPTIONS keeps the 405 it always got. The returned props are a copy, so the
// loaded manifest is untouched.
func withoutUnservedMethods(props spec3.PathProps, skip func(method string)) (spec3.PathProps, bool) {
	for _, m := range []struct {
		method string
		op     **spec3.Operation
	}{
		{http.MethodTrace, &props.Trace},
		{http.MethodOptions, &props.Options},
	} {
		if *m.op != nil {
			skip(m.method)
			*m.op = nil
		}
	}
	return props, len(builder.GetPathOperations(&props)) > 0
}

// parseManifestRoutes resolves each OpenAPI path of a version to a version
// route or a kind subresource route, sorted by path. Paths that would shadow
// resource storage, and methods that are not served, are reported to skip and
// left out.
func parseManifestRoutes(version app.ManifestVersion, skip func(path, reason string)) []manifestRoute {
	reserved := reservedResourceNames(version)
	kinds := map[string]*app.ManifestVersionKind{}
	for i := range version.Kinds {
		if plural := strings.ToLower(version.Kinds[i].Plural); plural != "" {
			kinds[plural] = &version.Kinds[i]
		}
	}

	declared := versionOpenAPI(version).Paths
	routes := make([]manifestRoute, 0, len(declared))
	for _, full := range slices.Sorted(maps.Keys(declared)) {
		props, served := withoutUnservedMethods(declared[full], func(method string) {
			skip(full, method+" is not served")
		})
		if !served {
			continue
		}
		route := manifestRoute{
			path:  strings.TrimPrefix(full, "/"),
			props: props,
		}
		if rest, ok := strings.CutPrefix(route.path, namespacedPrefix+"/"); ok {
			route.path = rest
			route.namespaced = true
		}

		root, below, _ := strings.Cut(route.path, "/")
		if kind := kinds[root]; kind != nil {
			sub, ok := strings.CutPrefix(below, "{"+nameParameter+"}/")
			first, _, _ := strings.Cut(sub, "/")
			switch {
			case !ok:
				skip(full, "shadows a resource path")
			case route.namespaced == (kind.Scope == kindstore.ClusterScope):
				skip(full, "does not match the kind scope")
			case first == "" || reservedSubresources[first]:
				skip(full, "shadows a subresource")
			default:
				route.kind = kind
				route.subresource = sub
				routes = append(routes, route)
			}
			continue
		}
		if root == "" || reserved[root] || (!route.namespaced && root == "namespaces") {
			skip(full, "shadows a resource path")
			continue
		}
		routes = append(routes, route)
	}
	return routes
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
func (b *manifestBuilder) routeHandler(gv schema.GroupVersion, route manifestRoute) http.HandlerFunc {
	path, resource := route.path, ""
	if route.kind != nil {
		path, resource = route.subresource, strings.ToLower(route.kind.Plural)
	}
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		if route.namespaced {
			// Read by the plugin's route info and by the storage lookup below.
			ctx = request.WithNamespace(ctx, r.PathValue(namespaceParameter))
			r = r.WithContext(ctx)
		}

		// Without this the plugin only sees the raw URL, and no group, version,
		// namespace or parent object.
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

// reservedResourceNames lists the path roots already claimed by resource storage
// in this version. A custom route mounted there would shadow the resource, or its
// generic subresources such as /search and /trash.
func reservedResourceNames(version app.ManifestVersion) map[string]bool {
	reserved := map[string]bool{apppluginV0.APP_RESOURCE_NAME: true}
	for _, kind := range version.Kinds {
		if kind.Plural != "" {
			reserved[strings.ToLower(kind.Plural)] = true
		}
	}
	return reserved
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

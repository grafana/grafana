package appplugin

import (
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strings"

	"github.com/gorilla/mux"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
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
	"github.com/grafana/grafana/pkg/services/apiserver/kindstore"
	"github.com/grafana/grafana/pkg/services/apiserver/searchroutes"
	"github.com/grafana/grafana/pkg/util/errhttp"
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

// dropUnservableMethods removes the operations the route mounter has no case
// for. Left in the spec, addRouteFromSpec rejects them and the error aborts
// apiserver startup -- one plugin's manifest would take down every group. The
// returned props are a copy, so the loaded manifest is untouched.
func dropUnservableMethods(props spec3.PathProps, warn func(method string)) (spec3.PathProps, bool) {
	for _, m := range []struct {
		method string
		op     **spec3.Operation
	}{
		{http.MethodHead, &props.Head},
		{http.MethodTrace, &props.Trace},
		{http.MethodOptions, &props.Options},
	} {
		if *m.op != nil {
			warn(m.method)
			*m.op = nil
		}
	}
	return props, len(builder.GetPathOperations(&props)) > 0
}

func (b *AppPluginAPIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	if b.manifest == nil {
		return nil
	}

	for _, version := range b.manifest.Versions {
		if version.Name != gv.Version || !version.Served {
			continue
		}
		return b.manifestRoutes(gv, version)
	}

	return nil
}

// manifestRoutes mounts a version's custom routes: version routes directly under
// the group version, and kind routes as subresources of a single object.
func (b *AppPluginAPIBuilder) manifestRoutes(gv schema.GroupVersion, version app.ManifestVersion) *builder.APIRoutes {
	routes := &builder.APIRoutes{}
	reserved := reservedResourceNames(version)

	addVersionRoute := func(dst *[]builder.APIRouteHandler, path string, props spec3.PathProps, params ...*spec3.Parameter) {
		path = strings.TrimPrefix(path, "/")
		if root, _, _ := strings.Cut(path, "/"); reserved[root] {
			logging.DefaultLogger.Warn("skipping manifest route that shadows a resource path",
				"group", gv.Group, "version", gv.Version, "path", path)
			return
		}
		props, served := dropUnservableMethods(props, func(method string) {
			logging.DefaultLogger.Warn("skipping manifest route method the apiserver cannot serve",
				"group", gv.Group, "version", gv.Version, "path", path, "method", method)
		})
		if !served {
			return
		}
		*dst = append(*dst, builder.APIRouteHandler{
			Path:    path,
			Spec:    withPathParameters(props, nil, params...),
			Schemas: version.Routes.Schemas,
			Handler: b.routeHandler(gv, "", path),
		})
	}
	for path, props := range version.Routes.Cluster {
		addVersionRoute(&routes.Root, path, props)
	}
	for path, props := range version.Routes.Namespaced {
		addVersionRoute(&routes.Namespace, path, props, namespacePathParameter())
	}

	// A manifest whose search declarations cannot be read cannot be searched, but
	// the rest of its API still works, so this drops search rather than the group.
	searchHandlers, err := b.searchRoutes(gv)
	if err != nil {
		logging.DefaultLogger.Error("invalid manifest search declarations; search and trash routes are not served",
			"group", gv.Group, "version", gv.Version, "error", err)
	}
	routes.Namespace = append(routes.Namespace, searchHandlers...)

	for _, kind := range version.Kinds {
		plural := strings.ToLower(kind.Plural)

		// Cluster kinds have no namespace segment to mount under.
		dst := &routes.Namespace
		params := []*spec3.Parameter{namespacePathParameter(), namePathParameter()}
		if kind.Scope == kindstore.ClusterScope {
			dst = &routes.Root
			params = []*spec3.Parameter{namePathParameter()}
		}

		for path, props := range kind.Routes {
			path = strings.TrimPrefix(path, "/")
			if path == "" || reservedSubresources[path] {
				logging.DefaultLogger.Warn("skipping manifest kind route that shadows a subresource",
					"group", gv.Group, "version", gv.Version, "kind", kind.Kind, "path", path)
				continue
			}
			props, served := dropUnservableMethods(props, func(method string) {
				logging.DefaultLogger.Warn("skipping manifest kind route method the apiserver cannot serve",
					"group", gv.Group, "version", gv.Version, "kind", kind.Kind, "path", path, "method", method)
			})
			if !served {
				continue
			}
			*dst = append(*dst, builder.APIRouteHandler{
				Path:    plural + "/{" + nameParameter + "}/" + path,
				Spec:    withPathParameters(props, []string{kind.Kind}, params...),
				Schemas: version.Routes.Schemas,
				Handler: b.routeHandler(gv, plural, path),
			})
		}
	}

	return routes
}

// searchRoutes builds the generic search and trash endpoints for the kinds this
// version serves.
//
// Delegated to searchroutes rather than mounted per kind here, because which
// kinds get these endpoints is not a decision this builder should be making on
// its own: the same manifest served as a custom resource definition goes through
// the same package, and a kind that is searchable one way must be searchable the
// other. That is where the config toggles, the enrolment rule and each kind's
// own opt-out are applied.
func (b *AppPluginAPIBuilder) searchRoutes(gv schema.GroupVersion) ([]builder.APIRouteHandler, error) {
	if b.search == nil {
		return nil, nil
	}

	// searchroutes matches manifests to served versions by the manifest's own
	// group, which is not always the group the plugin is served under. See
	// apiGroupForPlugin.
	manifest := *b.manifest
	manifest.Group = b.group

	built, err := searchroutes.BuildForServedGroupVersions(
		[]*app.ManifestData{&manifest},
		map[schema.GroupVersion]bool{gv: true},
		b.opts.SearchAPIEnabled,
		b.opts.TrashAPIEnabled,
		b.tracer,
		b.search,
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

// routeHandler forwards a manifest route to the plugin's v3 route service.
// resource is empty for version routes; for a kind subresource route it is the
// kind's plural, and the parent object's name comes from the path.
func (b *AppPluginAPIBuilder) routeHandler(gv schema.GroupVersion, resource, path string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

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

			if name := mux.Vars(r)[nameParameter]; name != "" {
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

				parent.SetName(name)
				parent.SetRv(m.GetResourceVersion())
				parent.SetRaw(raw)
			}
			info.Parent = parent
		}
		req := r.WithContext(httpadapter.WithRouteInfo(ctx, info))
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

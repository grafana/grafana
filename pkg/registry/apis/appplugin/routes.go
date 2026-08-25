package appplugin

import (
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
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// nameParameter is the path parameter carrying the parent object's name on a
// kind subresource route.
const nameParameter = "name"

// reservedSubresources are served by the kind store itself, so a manifest kind
// route may not claim them.
var reservedSubresources = map[string]bool{"status": true}

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

	addVersionRoute := func(dst *[]builder.APIRouteHandler, path string, props spec3.PathProps) {
		path = strings.TrimPrefix(path, "/")
		if root, _, _ := strings.Cut(path, "/"); reserved[root] {
			logging.DefaultLogger.Warn("skipping manifest route that shadows a resource path",
				"group", gv.Group, "version", gv.Version, "path", path)
			return
		}
		*dst = append(*dst, builder.APIRouteHandler{
			Path:    path,
			Spec:    &props,
			Schemas: version.Routes.Schemas,
			Handler: b.routeHandler(gv, "", path),
		})
	}
	for path, props := range version.Routes.Cluster {
		addVersionRoute(&routes.Root, path, props)
	}
	for path, props := range version.Routes.Namespaced {
		addVersionRoute(&routes.Namespace, path, props)
	}

	for _, kind := range version.Kinds {
		plural := strings.ToLower(kind.Plural)
		if plural == "" {
			continue
		}
		// Cluster kinds have no namespace segment to mount under.
		dst := &routes.Namespace
		if kind.Scope == clusterScope {
			dst = &routes.Root
		}

		for path, props := range kind.Routes {
			path = strings.TrimPrefix(path, "/")
			if path == "" || reservedSubresources[path] {
				logging.DefaultLogger.Warn("skipping manifest kind route that shadows a subresource",
					"group", gv.Group, "version", gv.Version, "kind", kind.Kind, "path", path)
				continue
			}
			*dst = append(*dst, builder.APIRouteHandler{
				Path:    plural + "/{" + nameParameter + "}/" + path,
				Spec:    withNameParameter(props),
				Schemas: version.Routes.Schemas,
				Handler: b.routeHandler(gv, plural, path),
			})
		}
	}

	return routes
}

// routeHandler forwards a manifest route to the plugin's v3 route service.
// resource is empty for version routes; for a kind subresource route it is the
// kind's plural, and the parent object's name comes from the path.
func (b *AppPluginAPIBuilder) routeHandler(gv schema.GroupVersion, resource, path string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		client, ok := b.clientV3(ctx)
		if !ok {
			errhttp.Write(ctx, apierrors.NewServiceUnavailable(
				"the plugin backend does not implement the v3 route service"), w)
			return
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
			name := mux.Vars(r)[nameParameter]
			if name == "" {
				errhttp.Write(ctx, apierrors.NewBadRequest("missing resource name"), w)
				return
			}
			parent := &pluginv3.RouteResource{}
			parent.SetResource(resource)
			parent.SetName(name)
			info.Parent = parent
			info.Path = resource + "/" + name + "/" + path
		}

		httpadapter.HandlerFunc(client).ServeHTTP(w, r.WithContext(httpadapter.WithRouteInfo(ctx, info)))
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

// withNameParameter documents the {name} segment that kind routes mount under.
// The operations are copied because they are shared with the loaded manifest.
func withNameParameter(props spec3.PathProps) *spec3.PathProps {
	out := props
	for _, op := range []**spec3.Operation{
		&out.Get, &out.Head, &out.Delete, &out.Post,
		&out.Put, &out.Patch, &out.Trace, &out.Options,
	} {
		if *op == nil {
			continue
		}
		*op = operationWithNameParameter(**op)
	}
	return &out
}

func operationWithNameParameter(op spec3.Operation) *spec3.Operation {
	if slices.ContainsFunc(op.Parameters, func(p *spec3.Parameter) bool {
		return p != nil && p.Name == nameParameter && p.In == "path"
	}) {
		return &op
	}
	op.Parameters = append(slices.Clone(op.Parameters), &spec3.Parameter{
		ParameterProps: spec3.ParameterProps{
			Name:        nameParameter,
			In:          "path",
			Required:    true,
			Description: "name of the parent resource",
			Schema:      spec.StringProperty(),
		},
	})
	return &op
}

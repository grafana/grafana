// Package keysroutes mounts the list-keys API on the kinds that support it.
// Endpoint: POST /apis/{group}/{version}/{resource}/list-keys.
package keysroutes

import (
	"slices"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/tracing"
	keysapi "github.com/grafana/grafana/pkg/registry/apis/keys"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// supportedKindScope is the only kind scope list-keys is mounted for. A
// cluster-scoped kind has no namespaces to list across, and it does register
// {resource}/{name}, which the endpoint path would collide with.
const supportedKindScope = "Namespaced"

// Build returns the keys routes to mount, or nil when the endpoint is off or there
// is no client to serve it with. builders and installers are the two ways a kind
// reaches the apiserver; a route is mounted only on a group version one serves.
func Build(
	enabled bool,
	tracer tracing.Tracer,
	store resourcepb.ResourceStoreClient,
	builders []builder.APIGroupBuilder,
	installers []appsdkapiserver.AppInstaller,
) []builder.GroupVersionRoutes {
	return BuildFromManifests(resource.AppManifests(), enabled, tracer, store, builders, installers)
}

// BuildFromManifests is Build with the kind declarations supplied by the caller,
// for a host that learns about apps after it starts.
func BuildFromManifests(
	manifests []*app.ManifestData,
	enabled bool,
	tracer tracing.Tracer,
	store resourcepb.ResourceStoreClient,
	builders []builder.APIGroupBuilder,
	installers []appsdkapiserver.AppInstaller,
) []builder.GroupVersionRoutes {
	manifests = slices.Concat(manifests, builder.ManifestsFromBuilders(builders))
	return BuildForServedGroupVersions(
		manifests, builder.ServedGroupVersions(builders, installers), enabled, tracer, store)
}

// BuildForServedGroupVersions is BuildFromManifests for a host that knows which
// group versions it serves without builders or installers to ask, such as an app
// plugin mounting its own manifest.
func BuildForServedGroupVersions(
	manifests []*app.ManifestData,
	served map[schema.GroupVersion]bool,
	enabled bool,
	tracer tracing.Tracer,
	store resourcepb.ResourceStoreClient,
) []builder.GroupVersionRoutes {
	// Callers own the toggle: they read it from their own config, and the plugin
	// spec builder sets it unconditionally to describe the route.
	if !enabled || store == nil {
		return nil
	}

	handler := keysapi.NewHandler(store, tracer)
	scopes := map[schema.GroupVersion]*routeScopes{}
	mounted := map[schema.GroupVersionResource]bool{}

	for _, m := range manifests {
		if m == nil {
			continue
		}
		for _, version := range m.Versions {
			if !version.Served {
				continue
			}
			gv := schema.GroupVersion{Group: m.Group, Version: version.Name}
			if !served[gv] {
				continue
			}
			for _, kind := range version.Kinds {
				if kind.Scope != supportedKindScope {
					continue
				}
				resourceName := resource.ManifestResourceName(kind)
				gvr := gv.WithResource(resourceName)
				if mounted[gvr] {
					continue
				}
				mounted[gvr] = true
				if scopes[gv] == nil {
					scopes[gv] = &routeScopes{}
				}
				scopes[gv].cluster = append(scopes[gv].cluster,
					handler.ListKeysRoute(gv.Group, gv.Version, resourceName, kind.Kind))
				scopes[gv].namespaced = append(scopes[gv].namespaced,
					handler.ListKeysInNamespaceRoute(gv.Group, gv.Version, resourceName, kind.Kind))
			}
		}
	}

	return toGroupVersionRoutes(scopes)
}

// The scopes share a path and differ only in where they mount.
type routeScopes struct {
	cluster    []keysapi.Route
	namespaced []keysapi.Route
}

func toGroupVersionRoutes(scopes map[schema.GroupVersion]*routeScopes) []builder.GroupVersionRoutes {
	out := make([]builder.GroupVersionRoutes, 0, len(scopes))
	for gv, s := range scopes {
		out = append(out, builder.GroupVersionRoutes{
			GroupVersion: gv,
			// Namespace prefixes .../namespaces/{namespace}/.
			Routes: &builder.APIRoutes{
				Root:      toHandlers(s.cluster),
				Namespace: toHandlers(s.namespaced),
			},
		})
	}
	return out
}

func toHandlers(routes []keysapi.Route) []builder.APIRouteHandler {
	handlers := make([]builder.APIRouteHandler, 0, len(routes))
	for _, r := range routes {
		handlers = append(handlers, builder.APIRouteHandler{
			Path:    r.Path,
			Spec:    r.Spec,
			Handler: r.Handler,
			Schemas: r.Schemas,
		})
	}
	return handlers
}

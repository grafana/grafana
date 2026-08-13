// Package searchroutes mounts the search API on the kinds that support it.
//
// It exists as glue because the routes are the same for every kind and so belong
// to no single builder, and because both the single-tenant and multi-tenant
// apiservers mount them from wiring that mirrors each other.
package searchroutes

import (
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/tracing"
	searchapi "github.com/grafana/grafana/pkg/registry/apis/search"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// namespacedScope is the manifest's spelling for a kind that lives in a
// namespace. Cluster-scoped kinds have no namespace to search within.
const namespacedScope = "Namespaced"

// allowed lists the kinds that expose the search API, as (group, resource).
//
// Temporary. Every namespaced kind is a candidate, but turning them all on at
// once would expose endpoints on kinds nobody has looked at yet, so the set is
// widened deliberately. A manifest opt-out replaces this.
var allowed = map[groupResource]bool{
	{group: "dashboard.grafana.app", resource: "dashboards"}: true,
	{group: "folder.grafana.app", resource: "folders"}:       true,
}

type groupResource struct {
	group    string
	resource string
}

// Build returns the search routes to mount, or nil when the endpoint is off or
// there is no client to serve it with.
//
// builders and installers are the two ways a kind reaches the apiserver; a route
// is only mounted on a group version one of them actually serves.
func Build(
	enabled bool,
	tracer tracing.Tracer,
	index resourcepb.ResourceIndexClient,
	builders []builder.APIGroupBuilder,
	installers []appsdkapiserver.AppInstaller,
) []builder.GroupVersionRoutes {
	// Whether the endpoint is on is read by the caller, because the two servers
	// that mount it are configured differently: one from an ini file, one from
	// flags.
	if !enabled || index == nil {
		return nil
	}

	// Search fields come from the compiled-in app manifests, the same
	// declarations the index mapping is built from.
	manifests := resource.AppManifests()
	handler := searchapi.NewHandler(index, resource.NewManifestBackedProvider(manifests), tracer)

	served := servedGroupVersions(builders, installers)
	byGroupVersion := map[schema.GroupVersion][]searchapi.Route{}

	for _, m := range manifests {
		if m.ManifestData == nil {
			continue
		}
		for _, version := range m.ManifestData.Versions {
			if !version.Served {
				continue
			}
			gv := schema.GroupVersion{Group: m.ManifestData.Group, Version: version.Name}
			if !served[gv] {
				continue
			}
			for _, kind := range version.Kinds {
				if kind.Scope != namespacedScope {
					continue
				}
				resourceName := resource.ManifestResourceName(kind)
				if !allowed[groupResource{group: gv.Group, resource: resourceName}] {
					continue
				}
				byGroupVersion[gv] = append(byGroupVersion[gv],
					handler.SearchRoute(gv.Group, gv.Version, resourceName, kind.Kind))
			}
		}
	}

	return toGroupVersionRoutes(byGroupVersion)
}

// servedGroupVersions reports which group versions this process actually serves.
// A manifest describes kinds that a given deployment may not serve at all.
func servedGroupVersions(
	builders []builder.APIGroupBuilder,
	installers []appsdkapiserver.AppInstaller,
) map[schema.GroupVersion]bool {
	served := map[schema.GroupVersion]bool{}
	for _, b := range builders {
		for _, gv := range builder.GetGroupVersions(b) {
			served[gv] = true
		}
	}
	for _, i := range installers {
		for _, gv := range i.GroupVersions() {
			served[gv] = true
		}
	}
	return served
}

func toGroupVersionRoutes(byGroupVersion map[schema.GroupVersion][]searchapi.Route) []builder.GroupVersionRoutes {
	out := make([]builder.GroupVersionRoutes, 0, len(byGroupVersion))
	for gv, routes := range byGroupVersion {
		handlers := make([]builder.APIRouteHandler, 0, len(routes))
		for _, r := range routes {
			handlers = append(handlers, builder.APIRouteHandler{
				Path:    r.Path,
				Spec:    r.Spec,
				Handler: r.Handler,
				Schemas: r.Schemas,
			})
		}
		out = append(out, builder.GroupVersionRoutes{
			GroupVersion: gv,
			Routes:       &builder.APIRoutes{Namespace: handlers},
		})
	}
	return out
}

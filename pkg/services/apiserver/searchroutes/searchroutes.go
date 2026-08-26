// Package searchroutes mounts the search API on the kinds that support it.
//
// It exists as glue because the routes are the same for every kind and so belong
// to no single builder, and because both the single-tenant and multi-tenant
// apiservers mount them from wiring that mirrors each other.
package searchroutes

import (
	"github.com/grafana/grafana-app-sdk/app"
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

// enrolledWithoutSearchFields keeps kinds that were already served but declare
// no search fields, which enrolled would otherwise drop.
//
// Temporary: we plan to stop asking for fields at all.
var enrolledWithoutSearchFields = map[string]bool{
	"folder.grafana.app/folders":      true,
	"dashboard.grafana.app/notebooks": true,
}

// enrolled reports whether a kind gets the search endpoints at all.
//
// Declared fields stand in for "someone reviewed this kind". Search works
// without them, so this gate is about review, not capability.
func enrolled(group, resourceName string, kind app.ManifestVersionKind) bool {
	return len(kind.SearchFields) > 0 || enrolledWithoutSearchFields[group+"/"+resourceName]
}

// Build returns the search and trash routes to mount, or nil when both are off or
// there is no client to serve them with.
//
// The two are switched separately because trash authorizes on a different rule
// that has not been reviewed yet. See searchapi.ConfigKeyTrash.
//
// builders and installers are the two ways a kind reaches the apiserver; a route
// is only mounted on a group version one of them actually serves.
func Build(
	searchEnabled bool,
	trashEnabled bool,
	tracer tracing.Tracer,
	index resourcepb.ResourceIndexClient,
	builders []builder.APIGroupBuilder,
	installers []appsdkapiserver.AppInstaller,
) []builder.GroupVersionRoutes {
	// Search fields come from the compiled-in app manifests, the same
	// declarations the index mapping is built from.
	return BuildFromManifests(resource.AppManifests(), searchEnabled, trashEnabled, tracer, index, builders, installers)
}

// BuildFromManifests is Build with the kind declarations supplied by the caller.
//
// A host that learns about apps after it starts can pass those manifests here,
// merged with the compiled-in set, and their kinds are mounted like any other.
// Build is the same call with only the compiled-in set.
//
// The provider is built from the manifests passed in, so a route can only ever
// validate against the declarations it was mounted from.
//
// Panics on a bad declaration, because in a compiled-in manifest that is a bug.
func BuildFromManifests(
	manifests []app.Manifest,
	searchEnabled bool,
	trashEnabled bool,
	tracer tracing.Tracer,
	index resourcepb.ResourceIndexClient,
	builders []builder.APIGroupBuilder,
	installers []appsdkapiserver.AppInstaller,
) []builder.GroupVersionRoutes {
	routes, err := BuildForServedGroupVersions(
		manifests,
		servedGroupVersions(builders, installers),
		searchEnabled,
		trashEnabled,
		tracer,
		index,
	)
	if err != nil {
		panic(err.Error())
	}
	return routes
}

// BuildForServedGroupVersions is BuildFromManifests for a host that has no
// builders or installers to derive the served group versions from, such as one
// serving its kinds as custom resource definitions.
//
// Returns an error rather than panicking, because manifests read at runtime can
// be malformed without this build being at fault.
func BuildForServedGroupVersions(
	manifests []app.Manifest,
	served map[schema.GroupVersion]bool,
	searchEnabled bool,
	trashEnabled bool,
	tracer tracing.Tracer,
	index resourcepb.ResourceIndexClient,
) ([]builder.GroupVersionRoutes, error) {
	// Whether an endpoint is on is read by the caller, because the two servers
	// that mount them are configured differently: one from an ini file, one from
	// flags.
	if (!searchEnabled && !trashEnabled) || index == nil {
		return nil, nil
	}

	provider, err := resource.ManifestBackedProvider(manifests)
	if err != nil {
		return nil, err
	}
	handler := searchapi.NewHandler(index, provider, tracer)

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
				if !enrolled(gv.Group, resourceName, kind) {
					continue
				}
				// Answered separately so a kind can opt out of one endpoint
				// without the other.
				if searchEnabled && kind.HasSearchEndpoint() {
					byGroupVersion[gv] = append(byGroupVersion[gv],
						handler.SearchRoute(gv.Group, gv.Version, resourceName, kind.Kind))
				}
				if trashEnabled && kind.HasTrashEndpoint() {
					byGroupVersion[gv] = append(byGroupVersion[gv],
						handler.TrashRoute(gv.Group, gv.Version, resourceName, kind.Kind))
				}
			}
		}
	}

	return toGroupVersionRoutes(byGroupVersion), nil
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

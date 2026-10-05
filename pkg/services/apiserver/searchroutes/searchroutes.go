// Package searchroutes mounts the search API on every namespaced kind a manifest
// declares, unless the kind opts out.
//
// It exists as glue because the routes are the same for every kind and so belong
// to no single builder, and because both the single-tenant and multi-tenant
// apiservers mount them from wiring that mirrors each other.
package searchroutes

import (
	"slices"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	searchapi "github.com/grafana/grafana/pkg/registry/apis/search"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// namespacedScope is the manifest's spelling for a kind that lives in a
// namespace. Cluster-scoped kinds have no namespace to search within.
const namespacedScope = "Namespaced"

type Options struct {
	HybridEnabled bool
}

// Build returns the search, trash and hybrid routes to mount, or nil when all are off or
// there is no client to serve them with.
//
// Each endpoint has its own switch. Trash also has a separate allowlist because
// it grants access differently from search. See resource.TrashSearchAllowed and
// searchapi.ConfigKeyTrash.
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
	opts Options,
) []builder.GroupVersionRoutes {
	return BuildFromManifests(resource.AppManifests(), searchEnabled, trashEnabled, tracer, index, builders, installers, opts)
}

// BuildFromManifests is Build with the kind declarations supplied by the caller.
//
// A host that learns about apps after it starts can pass those manifests here,
// merged with the compiled-in set, and their kinds are mounted like any other.
// Build supplies the compiled-in set. Both add builder manifests, and installer
// manifests for hybrid routes only.
//
// The provider is built from the manifests passed in, so a route can only ever
// validate against the declarations it was mounted from.
//
// Panics on a bad declaration, because in a compiled-in manifest that is a bug.
func BuildFromManifests(
	manifests []*app.ManifestData,
	searchEnabled bool,
	trashEnabled bool,
	tracer tracing.Tracer,
	index resourcepb.ResourceIndexClient,
	builders []builder.APIGroupBuilder,
	installers []appsdkapiserver.AppInstaller,
	opts Options,
) []builder.GroupVersionRoutes {
	builderManifests := builder.ManifestsFromBuilders(builders)
	served := builder.ServedGroupVersions(builders, installers)
	routes, err := BuildForServedGroupVersions(
		slices.Concat(manifests, builderManifests),
		served,
		searchEnabled,
		trashEnabled,
		tracer,
		index,
		Options{},
	)
	if err != nil {
		panic(err.Error())
	}
	if !opts.HybridEnabled {
		return routes
	}

	// Installer manifests enable hybrid opt-in without exposing new lexical or
	// trash routes, which default to enabled when a declaration is omitted.
	manifests = slices.Clone(manifests)
	for _, installer := range installers {
		manifests = append(manifests, installer.ManifestData())
	}
	hybridRoutes, err := BuildForServedGroupVersions(
		append(manifests, builderManifests...), served, false, false, tracer, index, opts,
	)
	if err != nil {
		panic(err.Error())
	}
	for _, hybrid := range hybridRoutes {
		i := slices.IndexFunc(routes, func(r builder.GroupVersionRoutes) bool {
			return r.GroupVersion == hybrid.GroupVersion
		})
		if i < 0 {
			routes = append(routes, hybrid)
		} else {
			routes[i].Routes.Namespace = append(routes[i].Routes.Namespace, hybrid.Routes.Namespace...)
		}
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
	manifests []*app.ManifestData,
	served map[schema.GroupVersion]bool,
	searchEnabled bool,
	trashEnabled bool,
	tracer tracing.Tracer,
	index resourcepb.ResourceIndexClient,
	opts Options,
) ([]builder.GroupVersionRoutes, error) {
	// Whether an endpoint is on is read by the caller, because the two servers
	// that mount them are configured differently: one from an ini file, one from
	// flags.
	if (!searchEnabled && !trashEnabled && !opts.HybridEnabled) || index == nil {
		return nil, nil
	}

	var handler *searchapi.Handler
	if searchEnabled || trashEnabled {
		provider, err := resource.ManifestBackedProvider(manifests...)
		if err != nil {
			return nil, err
		}
		handler = searchapi.NewHandler(index, provider, tracer)
	}
	hybridHandler := searchapi.NewHybridHandler(index, tracer)

	byGroupVersion := map[schema.GroupVersion][]searchapi.Route{}
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
				if kind.Scope != namespacedScope {
					continue
				}
				resourceName := resource.ManifestResourceName(kind)
				gvr := gv.WithResource(resourceName)
				if mounted[gvr] {
					continue
				}
				mounted[gvr] = true
				// A kind can opt out of each endpoint independently.
				if searchEnabled && kind.HasSearchEndpoint() {
					byGroupVersion[gv] = append(byGroupVersion[gv],
						handler.SearchRoute(gv.Group, gv.Version, resourceName, kind.Kind))
				}
				if trashEnabled && resource.TrashSearchAllowed(gv.Group, resourceName) && kind.HasTrashEndpoint() {
					byGroupVersion[gv] = append(byGroupVersion[gv],
						handler.TrashRoute(gv.Group, gv.Version, resourceName, kind.Kind))
				}
				if opts.HybridEnabled && kind.HasHybridEndpoint() {
					byGroupVersion[gv] = append(byGroupVersion[gv],
						hybridHandler.HybridSearchRoute(gv.Group, gv.Version, resourceName, kind.Kind))
				}
			}
		}
	}

	return toGroupVersionRoutes(byGroupVersion), nil
}

// BuildGlobalSearch returns the route for the search that spans resource types,
// or nil when there is no client to serve it with.
//
// It is mounted under the search group itself, because it belongs to no kind's
// group. Nothing serves kinds there, so the route is in no discovery document
// and a caller has to know the path.
func BuildGlobalSearch(
	tracer tracing.Tracer,
	index resourcepb.ResourceIndexClient,
	builders []builder.APIGroupBuilder,
) []builder.GroupVersionRoutes {
	if index == nil {
		return nil
	}
	kinds := globalSearchKinds(slices.Concat(resource.AppManifests(), builder.ManifestsFromBuilders(builders)))
	// No field provider: the global index has a fixed field set, which the
	// manifests do not declare.
	handler := searchapi.NewHandler(index, nil, tracer)
	gv := schema.GroupVersion{Group: searchv0.GROUP, Version: searchv0.VERSION}
	return toGroupVersionRoutes(map[schema.GroupVersion][]searchapi.Route{gv: {handler.GlobalSearchRoute(kinds)}})
}

// globalSearchKinds names the Kubernetes kind of each resource type the global
// index covers, which a result reports and which cannot be derived from its
// group and resource. Taken from every manifest, served here or not: the index
// covers its types whichever API versions this process serves.
func globalSearchKinds(manifests []*app.ManifestData) map[schema.GroupResource]string {
	kinds := map[schema.GroupResource]string{}
	for _, m := range manifests {
		if m == nil {
			continue
		}
		for _, version := range m.Versions {
			for _, kind := range version.Kinds {
				gr := schema.GroupResource{Group: m.Group, Resource: resource.ManifestResourceName(kind)}
				if resource.GlobalIndexCoversType(gr) {
					kinds[gr] = kind.Kind
				}
			}
		}
	}
	return kinds
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

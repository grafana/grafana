// Package searchroutes mounts the search API on every namespaced kind a manifest
// declares, unless the kind opts out.
//
// It exists as glue because the routes are the same for every kind and so belong
// to no single builder, and because both the single-tenant and multi-tenant
// apiservers mount them from wiring that mirrors each other.
package searchroutes

import (
	"slices"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana-app-sdk/app"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	appsdkapiserver "github.com/grafana/grafana/pkg/apiserver/appsdk"
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
// Trash has a separate allowlist because it grants access differently from search.
// See resource.TrashSearchAllowed.
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
	// The booleans also let BuildFromManifests build hybrid-only routes without
	// exposing lexical search or trash for installer manifests.
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
func BuildGlobalSearch(tracer tracing.Tracer, index resourcepb.ResourceIndexClient) []builder.GroupVersionRoutes {
	if index == nil {
		return nil
	}
	// From the manifests compiled in here, which may be a different release than
	// the search server's. A type it covers that these do not name is returned
	// with no kind.
	kinds := resource.GlobalSearchKinds()
	// No field provider: the global index has a fixed field set, which the
	// manifests do not declare.
	handler := searchapi.NewHandler(index, nil, tracer)
	gv := schema.GroupVersion{Group: searchv0.GROUP, Version: searchv0.VERSION}
	return toGroupVersionRoutes(map[schema.GroupVersion][]searchapi.Route{gv: {handler.GlobalSearchRoute(kinds)}})
}

// BuildGlobalHybridSearch retains locally registered resource identities for API
// authorization. The search backend owns hybrid eligibility.
func BuildGlobalHybridSearch(
	tracer tracing.Tracer,
	index resourcepb.ResourceIndexClient,
	builders []builder.APIGroupBuilder,
	installers []appsdkapiserver.AppInstaller,
	auth authorizer.Authorizer,
	defaultResourcePairs ...string,
) []builder.GroupVersionRoutes {
	if index == nil {
		return nil
	}
	manifests := slices.Clone(resource.AppManifests())
	for _, installer := range installers {
		manifests = append(manifests, installer.ManifestData())
	}
	manifests = append(manifests, builder.ManifestsFromBuilders(builders)...)
	targets := globalHybridSearchTargets(manifests, builder.ServedGroupVersions(builders, installers))
	defaultResources := make([]searchv0.HybridSearchResource, 0, len(defaultResourcePairs))
	for _, pair := range defaultResourcePairs {
		group, resourceName, _ := strings.Cut(pair, "/")
		defaultResources = append(defaultResources, searchv0.HybridSearchResource{Group: group, Resource: resourceName})
	}
	handler := searchapi.NewHybridHandler(index, tracer)
	gv := schema.GroupVersion{Group: searchv0.GROUP, Version: searchv0.VERSION}
	// A process that serves none of the types, such as the standalone search API
	// server, still names results from the manifests it has.
	kinds := map[schema.GroupResource]string{}
	for gr, gvk := range globalHybridSearchTargets(manifests, nil) {
		kinds[gr] = gvk.Kind
	}
	return toGroupVersionRoutes(map[schema.GroupVersion][]searchapi.Route{gv: {handler.GlobalHybridSearchRoute(targets, kinds, auth, defaultResources)}})
}

// globalHybridSearchTargets selects a registered version for API authorization
// and result kinds. Disabling an HTTP route must not bypass its authorization.
// A nil registered counts every version. The first manifest declaring a resource
// wins; within it, resource.ManifestKinds picks the version.
func globalHybridSearchTargets(manifests []*app.ManifestData, registered map[schema.GroupVersion]bool) map[schema.GroupResource]schema.GroupVersionKind {
	targets := map[schema.GroupResource]schema.GroupVersionKind{}
	for _, m := range manifests {
		if m == nil {
			continue
		}
		// Select one registered version for the API-level authorization check;
		// the storage search itself is version-independent.
		kinds := resource.ManifestKinds(m, func(version app.ManifestVersion, kind app.ManifestVersionKind) bool {
			return kind.Scope == namespacedScope &&
				(registered == nil || registered[schema.GroupVersion{Group: m.Group, Version: version.Name}])
		})
		for gr, gvk := range kinds {
			if _, ok := targets[gr]; !ok {
				targets[gr] = gvk
			}
		}
	}
	return targets
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

package builder

import (
	"fmt"
	"slices"

	restful "github.com/emicklei/go-restful/v3"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/discovery"
	genericapiserver "k8s.io/apiserver/pkg/server"
	serverstorage "k8s.io/apiserver/pkg/server/storage"
)

// InstallAPIGroupWithRoutes installs g on server like InstallAPIGroup, and also
// installs a group that has no resources but serves custom routes, advertising
// its route versions in discovery. It skips a group with neither. The custom
// routes themselves are mounted by AugmentWebServicesWithCustomRoutes, which
// must be called afterwards.
//
// A group with resources in any version is installed by InstallAPIGroup alone,
// which only advertises versions with resources. A version of such a group that
// serves only custom routes still serves them, but is missing from discovery;
// give it a resource to advertise it.
func InstallAPIGroupWithRoutes(server *genericapiserver.GenericAPIServer, g *genericapiserver.APIGroupInfo, builders []APIGroupBuilder, apiResourceConfig *serverstorage.ResourceConfig, experimentalAPIs bool) error {
	if len(g.VersionedResourcesStorageMap) > 0 {
		return server.InstallAPIGroup(g)
	}
	if routeVersions := routeVersions(g, builders, apiResourceConfig, experimentalAPIs); len(routeVersions) > 0 {
		return installRouteOnlyDiscovery(server, routeVersions)
	}
	return nil
}

// routeVersions returns the versions of a group in which builders serve custom
// routes, in priority order. Like v0alpha1 resources, a v0alpha1 version is only
// advertised with experimental APIs enabled, unless the builder allows all of
// its v0alpha1 resources.
func routeVersions(g *genericapiserver.APIGroupInfo, builders []APIGroupBuilder, apiResourceConfig *serverstorage.ResourceConfig, experimentalAPIs bool) []schema.GroupVersion {
	var versions []schema.GroupVersion
	for _, b := range builders {
		provider, ok := b.(APIGroupRouteProvider)
		if !ok || provider == nil {
			continue
		}
		for _, gv := range GetGroupVersions(b) {
			if slices.Contains(versions, gv) || !customRoutesEnabled(apiResourceConfig, gv) {
				continue
			}
			if gv.Version == "v0alpha1" && !experimentalAPIs && !slices.Contains(b.AllowedV0Alpha1Resources(), AllResourcesAllowed) {
				continue
			}
			if routes := provider.GetAPIRoutes(gv); routes != nil && len(routes.Root)+len(routes.Namespace) > 0 {
				versions = append(versions, gv)
			}
		}
	}

	slices.SortStableFunc(versions, func(a, b schema.GroupVersion) int {
		return versionPriority(g, a) - versionPriority(g, b)
	})
	return versions
}

func versionPriority(g *genericapiserver.APIGroupInfo, gv schema.GroupVersion) int {
	if i := slices.Index(g.PrioritizedVersions, gv); i >= 0 {
		return i
	}
	return len(g.PrioritizedVersions)
}

// installRouteOnlyDiscovery serves discovery for a group with no resources,
// whose versions only serve custom routes: /apis, /apis/<group>,
// /apis/<group>/<version> with an empty resource list, and aggregated
// discovery. InstallAPIGroup leaves such versions out, so this registers them
// directly, as the apiextensions-apiserver does for custom resources.
func installRouteOnlyDiscovery(server *genericapiserver.GenericAPIServer, versions []schema.GroupVersion) error {
	container := server.Handler.GoRestfulContainer
	group := versions[0].Group

	// The container exits on a duplicate root path, so fail on a conflict instead.
	rootPaths := make([]string, 0, 1+len(versions))
	rootPaths = append(rootPaths, "/apis/"+group)
	for _, gv := range versions {
		rootPaths = append(rootPaths, "/apis/"+gv.String())
	}
	for _, ws := range container.RegisteredWebServices() {
		if slices.Contains(rootPaths, ws.RootPath()) {
			return fmt.Errorf("discovery for %s is already registered", ws.RootPath())
		}
	}

	apiGroup := metav1.APIGroup{Name: group}
	for _, gv := range versions {
		apiGroup.Versions = append(apiGroup.Versions, metav1.GroupVersionForDiscovery{GroupVersion: gv.String(), Version: gv.Version})
	}
	apiGroup.PreferredVersion = apiGroup.Versions[0]
	server.DiscoveryGroupManager.AddGroup(apiGroup)
	container.Add(discovery.NewAPIGroupHandler(server.Serializer, apiGroup).WebService())

	noResources := discovery.APIResourceListerFunc(func() []metav1.APIResource { return []metav1.APIResource{} })
	for _, gv := range versions {
		// The custom routes are added to this WebService later, by
		// AugmentWebServicesWithCustomRoutes.
		ws := new(restful.WebService)
		ws.Path("/apis/" + gv.String())
		discovery.NewAPIVersionHandler(server.Serializer, gv, noResources).AddToWebService(ws)
		container.Add(ws)

		if server.AggregatedDiscoveryGroupManager != nil {
			server.AggregatedDiscoveryGroupManager.AddGroupVersion(group, apidiscoveryv2.APIVersionDiscovery{
				Version:   gv.Version,
				Resources: []apidiscoveryv2.APIResourceDiscovery{},
				Freshness: apidiscoveryv2.DiscoveryFreshnessCurrent,
			})
		}
	}
	return nil
}

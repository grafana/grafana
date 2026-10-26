package builder

import (
	"github.com/emicklei/go-restful/v3"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/discovery"
	"k8s.io/apiserver/pkg/endpoints/discovery/aggregated"
)

// AddGroupDiscovery lists a group version that has routes but no resources in
// discovery, as InstallAPIGroups does for one with resources. Nothing else lists
// it, and the Grafana router learns which groups a server serves from its /apis.
//
// Call it after AugmentWebServicesWithCustomRoutes, so the version document is
// added to the WebService that already holds the routes.
func AddGroupDiscovery(
	container *restful.Container, groups discovery.GroupManager, aggregatedGroups aggregated.ResourceManager,
	serializer runtime.NegotiatedSerializer, gv schema.GroupVersion,
) {
	version := metav1.GroupVersionForDiscovery{GroupVersion: gv.String(), Version: gv.Version}
	group := metav1.APIGroup{Name: gv.Group, Versions: []metav1.GroupVersionForDiscovery{version}, PreferredVersion: version}
	// Either is nil when discovery is left to the apiextensions server.
	if aggregatedGroups != nil {
		aggregatedGroups.AddGroupVersion(gv.Group, apidiscoveryv2.APIVersionDiscovery{
			Version:   gv.Version,
			Freshness: apidiscoveryv2.DiscoveryFreshnessCurrent,
		})
	}
	if groups != nil {
		groups.AddGroup(group)
	}
	container.Add(discovery.NewAPIGroupHandler(serializer, group).WebService())

	// The aggregator checks this document before it routes to the server.
	versionHandler := discovery.NewAPIVersionHandler(serializer, gv, discovery.APIResourceListerFunc(func() []metav1.APIResource {
		return []metav1.APIResource{}
	}))
	root := "/apis/" + gv.String()
	for _, ws := range container.RegisteredWebServices() {
		// A second WebService on the routes' root path would shadow them.
		if ws.RootPath() == root {
			versionHandler.AddToWebService(ws)
			return
		}
	}
	ws := new(restful.WebService).Path(root)
	versionHandler.AddToWebService(ws)
	container.Add(ws)
}

package appsdk

import (
	"fmt"

	"github.com/emicklei/go-restful/v3"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	"k8s.io/apimachinery/pkg/runtime/schema"
	discoveryendpoint "k8s.io/apiserver/pkg/endpoints/discovery/aggregated"
)

// AdvertiseRouteOnlyVersion lists a group version that serves routes but no
// resources in aggregated discovery. k8s only lists versions it installed
// resources for, and the Grafana router builds its routing table from
// aggregated discovery, so without an entry the router does not serve the
// group at all.
func AdvertiseRouteOnlyVersion(manager discoveryendpoint.ResourceManager, gv schema.GroupVersion) {
	if manager == nil {
		return
	}
	manager.AddGroupVersion(gv.Group, apidiscoveryv2.APIVersionDiscovery{
		Version:   gv.Version,
		Freshness: apidiscoveryv2.DiscoveryFreshnessCurrent,
	})
}

// installRouteOnlyVersion makes sure a version with no resources has a web
// service to hang its routes on, and is listed in aggregated discovery.
func installRouteOnlyVersion(container *restful.Container, manager discoveryendpoint.ResourceManager, gv schema.GroupVersion) {
	rootPath := fmt.Sprintf("/apis/%s/%s", gv.Group, gv.Version)
	found := false
	// A web service exists already if another version of the group had kinds.
	for _, ws := range container.RegisteredWebServices() {
		if ws.RootPath() == rootPath {
			found = true
			break
		}
	}
	if !found {
		ws := new(restful.WebService)
		ws.Path(rootPath).Produces("application/json")
		container.Add(ws)
	}
	AdvertiseRouteOnlyVersion(manager, gv)
}

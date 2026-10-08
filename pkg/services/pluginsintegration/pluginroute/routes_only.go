package pluginroute

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

// routesOnlyStorageKey holds the placeholder for a version that serves custom
// routes but no resources.
const routesOnlyStorageKey = "__routes"

// routesOnlyStorage keeps a routes-only version installed. The apiserver skips
// any group version without storage, which would leave its routes out of
// discovery and OpenAPI.
//
// It implements no verbs, so the installer mounts no handlers or OpenAPI paths
// for it; it only shows up in discovery as a resource with no verbs.
type routesOnlyStorage struct{}

var (
	_ rest.Storage              = (*routesOnlyStorage)(nil)
	_ rest.Scoper               = (*routesOnlyStorage)(nil)
	_ rest.SingularNameProvider = (*routesOnlyStorage)(nil)
)

// New returns Settings because the installer resolves the storage kind through
// the scheme, and Settings is registered in every served version.
func (s *routesOnlyStorage) New() runtime.Object {
	return &apppluginV0.Settings{}
}

func (s *routesOnlyStorage) NamespaceScoped() bool {
	return true
}

func (s *routesOnlyStorage) GetSingularName() string {
	return routesOnlyStorageKey
}

func (s *routesOnlyStorage) Destroy() {}

// hasRoutes reports whether any custom route is mounted.
func hasRoutes(routes *builder.APIRoutes) bool {
	return routes != nil && (len(routes.Root) > 0 || len(routes.Namespace) > 0)
}

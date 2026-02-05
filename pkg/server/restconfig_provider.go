package server

import (
	"github.com/grafana/grafana/pkg/services/apiserver"
)

// ProvideRestConfigProviderForModuleServer provides a RestConfigProvider for the ModuleServer.
// This wrapper is needed because wire cannot bind the private eventualRestConfigProvider type
// from outside the apiserver package.
func ProvideRestConfigProviderForModuleServer() apiserver.RestConfigProvider {
	return apiserver.ProvideEventualRestConfigProvider()
}

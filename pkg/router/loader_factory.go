package router

import (
	"github.com/grafana/authlib/types"

	secret "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// ProvideRoutesLoader prefers configured cloud routes, then local plugins.
// Dummy groups let the router run when neither source is available.
func ProvideRoutesLoader(cfg *setting.Cfg, deps PluginLoaderDependencies) (RoutesLoader, error) {
	if cloud, err := ProvideCloudRoutesLoaderFactory(cfg); err != nil {
		return nil, err
	} else if cloud != nil {
		return cloud, nil
	}

	// Plugin sources
	if deps.PluginSources != nil {
		return newPluginLoader(deps)
	}

	return dummyRoutesLoader{groups: []string{
		"dummy-backend-1.ext.grafana.app",
		"dummy-backend-2.ext.grafana.app",
	}}, nil
}

// RoutesLoaderClients groups clients that are constructed by the router module
// before the remaining routes loader dependencies are initialized.
type RoutesLoaderClients struct {
	Resource     resource.ResourceClient
	Access       types.AccessClient
	DualWrite    dualwrite.Service
	SecureValues secret.InlineSecureValueSupport
}

package router

import (
	"github.com/grafana/authlib/types"

	secret "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// ProvideRoutesLoader prefers configured cloud routes (appmanifest apiserver,
// the two fixed aggregate targets, and/or plugins_url -- see
// ProvideCloudRoutesLoaderFactory), then local plugins. Dummy groups let the
// router run when none of those sources are available.
func ProvideRoutesLoader(cfg *setting.Cfg, deps PluginLoaderDependencies) (RoutesLoader, error) {
	if cloud, err := ProvideCloudRoutesLoaderFactory(cfg, deps.PluginDependencies); err != nil || cloud != nil {
		return cloud, err
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

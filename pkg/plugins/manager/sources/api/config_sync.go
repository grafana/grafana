package api

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
)

// ConfigSyncer is the interface for syncing local config to the API.
type ConfigSyncer interface {
	Sync(ctx context.Context, source install.Source, installs []setting.InstallPlugin) error
}

type configSyncer struct {
	registrar *install.InstallSourceAPIRegistration
}

func NewConfigSyncer(clientGenerator resource.ClientGenerator) ConfigSyncer {
	return &configSyncer{registrar: install.NewInstallSourceAPIRegistration(clientGenerator)}
}

func (c *configSyncer) Sync(ctx context.Context, source install.Source, installs []setting.InstallPlugin) error {
	for _, install := range installs {
		err := c.registrar.Register(ctx, "default", toPluginInstall(install, source))
		if err != nil {
			return err
		}
	}
	return nil
}

func toPluginInstall(cfgInstall setting.InstallPlugin, source install.Source) *install.PluginInstall {
	installClass := install.ClassExternal
	if cfgInstall.Class != "" {
		installClass = install.Class(cfgInstall.Class)
	}
	return &install.PluginInstall{
		ID:      cfgInstall.ID,
		Version: cfgInstall.Version,
		URL:     cfgInstall.URL,
		Class:   installClass,
		Source:  source,
	}
}

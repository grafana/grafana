package pluginupdatechecker

import (
	"context"
	"slices"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/services/pluginsintegration/managedplugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugininstaller"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/provisionedplugins"
)

type PluginUpdateChecker interface {
	IsUpdatable(ctx context.Context, plugin pluginstore.Plugin) bool
}

var _ PluginUpdateChecker = (*Service)(nil)

type Service struct {
	managedPluginsManager     managedplugins.Manager
	provisionedPluginsManager provisionedplugins.Manager
	PluginPreinstall          plugininstaller.Preinstall
	provisionedPlugins        []string
	log                       log.Logger
}

func ProvideService(
	managedPluginsManager managedplugins.Manager,
	provisionedPluginsManager provisionedplugins.Manager,
	pluginPreinstall plugininstaller.Preinstall,
) *Service {
	return &Service{
		managedPluginsManager:     managedPluginsManager,
		provisionedPluginsManager: provisionedPluginsManager,
		PluginPreinstall:          pluginPreinstall,
		log:                       log.New("plugin.updatechecker"),
	}
}

func (s *Service) isManaged(ctx context.Context, pluginID string) bool {
	for _, managedPlugin := range s.managedPluginsManager.ManagedPlugins(ctx) {
		if managedPlugin == pluginID {
			return true
		}
	}
	return false
}

func (s *Service) isProvisioned(ctx context.Context, pluginID string) bool {
	if s.provisionedPlugins == nil {
		var err error
		s.provisionedPlugins, err = s.provisionedPluginsManager.ProvisionedPlugins(ctx)
		if err != nil {
			return false
		}
	}
	return slices.Contains(s.provisionedPlugins, pluginID)
}

func (s *Service) IsUpdatable(ctx context.Context, plugin pluginstore.Plugin) bool {
	if plugin.IsCorePlugin() {
		s.log.Debug("Skipping core plugin", "plugin", plugin.ID)
		return false
	}

	if s.isManaged(ctx, plugin.ID) {
		s.log.Debug("Skipping managed plugin", "plugin", plugin.ID)
		return false
	}

	if s.PluginPreinstall.IsPinned(plugin.ID) {
		s.log.Debug("Skipping pinned plugin", "plugin", plugin.ID)
		return false
	}

	if s.isProvisioned(ctx, plugin.ID) {
		s.log.Debug("Skipping provisioned plugin", "plugin", plugin.ID)
		return false
	}

	return true
}

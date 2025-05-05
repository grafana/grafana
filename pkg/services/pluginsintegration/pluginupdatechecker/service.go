package pluginupdatechecker

import (
	"context"
	"slices"

	"github.com/Masterminds/semver"
	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/services/pluginsintegration/managedplugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugininstaller"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/provisionedplugins"
)

type PluginUpdateChecker interface {
	IsUpdatable(ctx context.Context, plugin pluginstore.Plugin) bool
	CanUpdateMinor(currentVersion string, targetVersion string) bool
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

func (s *Service) CanUpdateMinor(currentVersion string, targetVersion string) bool {
	// If we are already on the latest version, skip the installation
	if currentVersion == targetVersion {
		s.log.Debug("Latest plugin already installed", "version", targetVersion)
		return false
	}

	// If the latest version is a new major version, skip the installation
	parsedLatestVersion, err := semver.NewVersion(targetVersion)
	if err != nil {
		s.log.Error("Failed to parse latest version, skipping potential update", "version", targetVersion, "error", err)
		return false
	}
	parsedCurrentVersion, err := semver.NewVersion(currentVersion)
	if err != nil {
		s.log.Error("Failed to parse current version, skipping potential update", "version", currentVersion, "error", err)
		return false
	}
	if parsedLatestVersion.Major() > parsedCurrentVersion.Major() {
		s.log.Debug("New major version available, skipping update due to possible breaking changes", "version", targetVersion)
		return false
	}

	// We should update the plugin
	return true
}

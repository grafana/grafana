package pluginchecker

import (
	"context"
	"fmt"
	"slices"

	"github.com/Masterminds/semver"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/managedplugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/provisionedplugins"
)

type PluginUpdateChecker interface {
	IsUpdatable(ctx context.Context, plugin pluginstore.Plugin) bool
	CanUpdate(pluginId string, currentVersion string, targetVersion string, onlyMinor bool) bool
}

var _ PluginUpdateChecker = (*Service)(nil)

type Service struct {
	managedPluginsManager     managedplugins.Manager
	provisionedPluginsManager provisionedplugins.Manager
	pluginPreinstall          Preinstall
	provisionedPlugins        []string
	log                       log.Logger
}

func ProvideService(
	managedPluginsManager managedplugins.Manager,
	provisionedPluginsManager provisionedplugins.Manager,
	pluginPreinstall Preinstall,
) *Service {
	return &Service{
		managedPluginsManager:     managedPluginsManager,
		provisionedPluginsManager: provisionedPluginsManager,
		pluginPreinstall:          pluginPreinstall,
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
		pps, err := s.provisionedPluginsManager.ProvisionedPlugins(ctx)
		if err != nil {
			return false
		}
		s.provisionedPlugins = make([]string, len(pps))
		for _, pp := range pps {
			s.provisionedPlugins = append(s.provisionedPlugins, pp.ID)
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

	if s.pluginPreinstall.IsPinned(plugin.ID) {
		s.log.Debug("Skipping pinned plugin", "plugin", plugin.ID)
		return false
	}

	if s.isProvisioned(ctx, plugin.ID) {
		s.log.Debug("Skipping provisioned plugin", "plugin", plugin.ID)
		return false
	}

	return true
}

func (s *Service) CanUpdate(pluginId string, currentVersion string, targetVersion string, onlyMinor bool) bool {
	canUpdate, reason := CanUpdateVersion(currentVersion, targetVersion, onlyMinor)
	if !canUpdate {
		s.log.Debug("Skipping update", "pluginId", pluginId, "reason", reason)
	}
	return canUpdate
}

func CanUpdateVersion(currentVersion string, targetVersion string, onlyMinor bool) (bool, string) {
	// If we are already on the latest version, skip the installation
	if currentVersion == targetVersion {
		return false, fmt.Sprintf("Latest plugin already installed: %s", targetVersion)
	}

	// If the latest version is a new major version, skip the installation
	parsedLatestVersion, err := semver.NewVersion(targetVersion)
	if err != nil {
		return false, fmt.Sprintf("Failed to parse latest version %s: %s", targetVersion, err)
	}
	parsedCurrentVersion, err := semver.NewVersion(currentVersion)
	if err != nil {
		return false, fmt.Sprintf("Failed to parse current version %s: %s", currentVersion, err)
	}

	if onlyMinor && (parsedLatestVersion.Major() > parsedCurrentVersion.Major()) {
		return false, fmt.Sprintf("New major version available, skipping update due to possible breaking changes: %s", targetVersion)
	}

	if parsedCurrentVersion.Compare(parsedLatestVersion) >= 0 {
		return false, fmt.Sprintf("No update available: %s", targetVersion)
	}

	// We should update the plugin
	return true, ""
}

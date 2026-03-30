package install

import (
	"context"
	"runtime"

	"github.com/grafana/grafana-app-sdk/logging"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

var _ InstallManager = (*LocalManager)(nil)

// LocalManager implements InstallManager for single-tenant (on-prem) deployments.
// It uses the plugins.Installer to perform actual plugin installation on the filesystem.
// After installation, it queries the PluginStore to discover child plugins and creates
// Plugin resources for them with owner references for automatic cascade deletion.
type LocalManager struct {
	installer      plugins.Installer
	pluginStore    pluginstore.Store
	registrar      Registrar
	grafanaVersion string
	logger         logging.Logger
}

func NewLocalManager(
	installer plugins.Installer,
	pluginStore pluginstore.Store,
	registrar Registrar,
	grafanaVersion string,
	logger logging.Logger,
) *LocalManager {
	return &LocalManager{
		installer:      installer,
		pluginStore:    pluginStore,
		registrar:      registrar,
		grafanaVersion: grafanaVersion,
		logger:         logger,
	}
}

func (m *LocalManager) Install(ctx context.Context, plugin *pluginsv0alpha1.Plugin) error {
	addOpts := plugins.NewAddOpts(
		m.grafanaVersion,
		runtime.GOOS,
		runtime.GOARCH,
		stringValue(plugin.Spec.Url),
	)

	err := m.installer.Add(ctx, plugin.Spec.Id, plugin.Spec.Version, addOpts)
	if err != nil {
		return err
	}

	// Register child plugins if any
	return m.registerChildren(ctx, plugin)
}

func (m *LocalManager) Update(ctx context.Context, oldPlugin, newPlugin *pluginsv0alpha1.Plugin) error {
	// Check if spec has changed
	specChanged := oldPlugin.Spec.Id != newPlugin.Spec.Id ||
		oldPlugin.Spec.Version != newPlugin.Spec.Version ||
		stringValue(oldPlugin.Spec.Url) != stringValue(newPlugin.Spec.Url)

	if !specChanged {
		// No actual plugin changes, just metadata
		return nil
	}

	m.logger.Info("Plugin spec changed, reinstalling",
		"pluginId", newPlugin.Spec.Id,
		"oldVersion", oldPlugin.Spec.Version,
		"newVersion", newPlugin.Spec.Version,
	)

	err := m.installer.Remove(ctx, oldPlugin.Spec.Id, oldPlugin.Spec.Version)
	if err != nil {
		m.logger.Warn("Failed to remove old plugin version", "error", err)
		// Continue with installation anyway
	}

	// Install new version
	addOpts := plugins.NewAddOpts(
		m.grafanaVersion,
		runtime.GOOS,
		runtime.GOARCH,
		stringValue(newPlugin.Spec.Url),
	)

	err = m.installer.Add(ctx, newPlugin.Spec.Id, newPlugin.Spec.Version, addOpts)
	if err != nil {
		return err
	}

	// Re-register child plugins with updated parent version
	return m.registerChildren(ctx, newPlugin)
}

func (m *LocalManager) Uninstall(ctx context.Context, plugin *pluginsv0alpha1.Plugin) error {
	return m.installer.Remove(ctx, plugin.Spec.Id, plugin.Spec.Version)
}

// registerChildren queries the PluginStore for child plugins and creates Plugin resources
// for each child with owner references to enable automatic cascade deletion.
func (m *LocalManager) registerChildren(ctx context.Context, parent *pluginsv0alpha1.Plugin) error {
	// If pluginStore or registrar is nil, skip child registration
	if m.pluginStore == nil || m.registrar == nil {
		return nil
	}

	// Query PluginStore for the parent plugin to get its children
	storePlugin, exists := m.pluginStore.Plugin(ctx, parent.Spec.Id)
	if !exists {
		m.logger.Warn("Plugin not found in store after installation", "pluginId", parent.Spec.Id)
		return nil
	}

	// If no children, nothing to do
	if len(storePlugin.Children) == 0 {
		return nil
	}

	m.logger.Info("Registering child plugins", "parentId", parent.Spec.Id, "childCount", len(storePlugin.Children))

	// Create Plugin resources for each child
	for _, childID := range storePlugin.Children {
		childInstall := &PluginInstall{
			ID:       childID,
			Version:  parent.Spec.Version, // Use parent version for all children
			Source:   SourceChildPluginReconciler,
			ParentID: parent.Spec.Id,
		}

		err := m.registrar.RegisterWithOwner(ctx, parent.Namespace, childInstall, parent)
		if err != nil {
			m.logger.Error("Failed to register child plugin",
				"parentId", parent.Spec.Id,
				"childId", childID,
				"error", err,
			)
			// Continue with other children even if one fails
		}
	}

	return nil
}

// stringValue safely dereferences a string pointer, returning empty string if nil
func stringValue(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

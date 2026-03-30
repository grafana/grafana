package install

import (
	"context"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

// InstallManager handles plugin installation, updates, and removal
// at the storage layer. Implementations differ between single-tenant and multi-tenant modes.
type InstallManager interface {
	// Install installs a plugin based on the Plugin resource spec.
	// Returns an error if installation fails.
	Install(ctx context.Context, plugin *pluginsv0alpha1.Plugin) error

	// Update updates an existing plugin installation.
	// Returns an error if the update fails.
	Update(ctx context.Context, oldPlugin, newPlugin *pluginsv0alpha1.Plugin) error

	// Uninstall removes a plugin installation.
	// Returns an error if uninstallation fails.
	Uninstall(ctx context.Context, plugin *pluginsv0alpha1.Plugin) error
}

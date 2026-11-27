package marketplacelicensing

import "github.com/grafana/grafana/pkg/plugins"

// LicensePluginID returns the plugin ID whose marketplace license applies to plugin.
// Nested plugins are distributed and licensed as part of their parent, so they use the parent's license.
func LicensePluginID(plugin *plugins.Plugin) string {
	if plugin.Parent != nil {
		return plugin.Parent.PluginID()
	}
	return plugin.PluginID()
}

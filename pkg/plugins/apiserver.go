package plugins

import (
	"fmt"
	"strings"
)

// DefaultAPIGroupVersion returns the API group and version Grafana serves a
// plugin's API at, until plugins declare their own. The values mirror what the
// datasource API server and the app plugin settings API register; they live here
// so light modules can use them without importing those packages.
// ok is false for plugin types without an API.
func DefaultAPIGroupVersion(pluginID string, pluginType Type) (group, version string, ok bool) {
	switch pluginType {
	case TypeDataSource:
		return pluginID + ".datasource.grafana.app", "v0alpha1", true
	case TypeApp:
		return pluginID, "v0alpha1", true
	default:
		return "", "", false
	}
}

// Get the default API group name for from a plugin ID
// NOTE: this is a work in progress, and may change without notice
func GetDatasourceGroupNameFromPluginID(pluginId string) (string, error) {
	if pluginId == "" {
		return "", fmt.Errorf("bad pluginID (empty)")
	}
	parts := strings.Split(pluginId, "-")
	if len(parts) == 1 {
		return fmt.Sprintf("%s.datasource.grafana.app", parts[0]), nil
	}

	last := parts[len(parts)-1]
	if last != "datasource" {
		return "", fmt.Errorf("bad pluginID (%s)", pluginId)
	}
	if parts[0] == "grafana" {
		parts = parts[1:] // strip the first value
	}
	return fmt.Sprintf("%s.datasource.grafana.app", strings.Join(parts[:len(parts)-1], "-")), nil
}

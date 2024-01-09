package datasource

import (
	"fmt"
	"strings"
)

func getDatasourceGroupNameFromPluginID(pluginId string) (string, error) {
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

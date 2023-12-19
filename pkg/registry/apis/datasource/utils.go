package datasource

import (
	"fmt"
	"strings"
)

func getInvalidDatasourceGroupName(pluginId string) string {
	return "*** InvalidDatasourceGroupName: " + pluginId + "***" // will not register!
}

func getDatasourceGroupNameFromPluginID(pluginId string) string {
	if pluginId == "" {
		return getInvalidDatasourceGroupName(pluginId)
	}
	parts := strings.Split(pluginId, "-")
	if len(parts) == 1 {
		return fmt.Sprintf("%s.datasource.grafana.app", parts[0])
	}

	last := parts[len(parts)-1]
	if last != "datasource" {
		return getInvalidDatasourceGroupName(pluginId)
	}
	if parts[0] == "grafana" {
		parts = parts[1:] // strip the first value
	}
	return fmt.Sprintf("%s.datasource.grafana.app", strings.Join(parts[:len(parts)-1], "-"))
}

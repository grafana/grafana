package datasource

import (
	"fmt"
	"strings"
)

func getInvalidGroupName(pluginId string) string {
	return "*** InvalidGroupName: " + pluginId + "***" // will not register!
}

func getDatasourceGroupNameFromPluginID(pluginId string) string {
	parts := strings.Split(pluginId, "-")
	switch len(parts) {
	case 3:
		if parts[2] != "datasource" {
			return getInvalidGroupName(pluginId)
		}
		if parts[0] == "grafana" {
			return fmt.Sprintf("%s.datasource.grafana.app", parts[1])
		}
		return fmt.Sprintf("%s-%s.datasource.grafana.app", parts[0], parts[1])
	case 2:
		if parts[1] != "datasource" {
			return getInvalidGroupName(pluginId)
		}
		return fmt.Sprintf("%s.datasource.grafana.app", parts[0])
	case 1:
		// only valid for internal core datasources
		return fmt.Sprintf("%s.datasource.grafana.app", parts[0])
	}
	return getInvalidGroupName(pluginId)
}

package plugins

import (
	"fmt"
)

// Get the default API group name from a plugin
// Currently hardcoded, but we need to keep that transparent so it can be configured later
// Eventually the group + core metadata will be defined from:
// https://github.com/grafana/grafana/tree/main/apps/plugins/kinds
func GetAPIGroup(plugin JSONData) (group string, ok bool) {
	if plugin.Type == TypeDataSource {
		return fmt.Sprintf("%s.datasource.grafana.app", plugin.ID), true
	}
	return "", false
}

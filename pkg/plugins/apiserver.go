package plugins

import (
	"errors"
	"fmt"
	"strings"
)

// GetDatasourceGroupNameFromPluginID returns the default API group name for a given plugin ID.
// NOTE: this is a work in progress, and may change without notice
func GetDatasourceGroupNameFromPluginID(pluginID string) (string, error) {
	if pluginID == "" {
		return "", errors.New("bad pluginID (empty)")
	}
	parts := strings.Split(pluginID, "-")
	if len(parts) == 1 {
		return appendDataSourceGroupSuffix(parts[0]), nil
	}

	last := parts[len(parts)-1]
	if last != "datasource" {
		return "", fmt.Errorf("bad pluginID (%s)", pluginID)
	}

	switch pluginID {
	case "grafana-testdata-datasource":
		return appendDataSourceGroupSuffix("testdata"), nil
	default:
		return appendDataSourceGroupSuffix(pluginID), nil
	}
}

// GetPluginIDFromDatasourceGroupName returns the plugin ID for a given datasource group name.
func GetPluginIDFromDatasourceGroupName(group string) string {
	return strings.Split(group, ".")[0]
}

func appendDataSourceGroupSuffix(group string) string {
	return fmt.Sprintf("%s.datasource.grafana.app", group)
}

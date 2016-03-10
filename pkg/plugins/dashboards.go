package plugins

import (
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

type PluginDashboardInfoDTO struct {
	Title             string
	InstalledURI      string
	InstalledRevision string
	Revision          string
	Description       string
}

func GetPluginDashboards(orgId int64, pluginId string) ([]*PluginDashboardInfoDTO, error) {
	plugin, exists := Plugins[pluginId]

	if !exists {
		return nil, &PluginNotFoundError{pluginId}
	}

	result := make([]*PluginDashboardInfoDTO, 0)

	for _, include := range plugin.Includes {
		if include.Type == PluginTypeDashboard {
			if dashInfo, err := getDashboardImportStatus(orgId, plugin, include); err != nil {
				return nil, err
			} else {
				result = append(result, dashInfo)
			}
		}
	}

	return result, nil
}

func getDashboardImportStatus(orgId int64, plugin *PluginBase, dashInclude *PluginInclude) (*PluginDashboardInfoDTO, error) {
	res := &PluginDashboardInfoDTO{}

	dashboardFilePath := filepath.Join(plugin.PluginDir, dashInclude.Path)
	reader, err := os.Open(dashboardFilePath)
	if err != nil {
		return nil, err
	}

	defer reader.Close()

	jsonParser := json.NewDecoder(reader)
	var data map[string]interface{}

	if err := jsonParser.Decode(&data); err != nil {
		return nil, err
	}

	dashboard := m.NewDashboardFromJson(data)

	res.Title = dashboard.Title
	res.Revision = dashboard.GetString("revision", "1.0")

	query := m.GetDashboardQuery{OrgId: orgId, Slug: dashboard.Slug}

	if err := bus.Dispatch(&query); err != nil {
		if err != m.ErrDashboardNotFound {
			return nil, err
		}
	} else {
		res.InstalledURI = "db/" + query.Result.Slug
		res.InstalledRevision = query.Result.GetString("revision", "1.0")
	}

	return res, nil
}

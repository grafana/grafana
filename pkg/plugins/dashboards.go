package plugins

import (
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
)

type PluginDashboardInfoDTO struct {
	PluginId         string `json:"pluginId"`
	Title            string `json:"title"`
	Imported         bool   `json:"imported"`
	ImportedUri      string `json:"importedUri"`
	ImportedRevision int64  `json:"importedRevision"`
	Revision         int64  `json:"revision"`
	Description      string `json:"description"`
	Path             string `json:"path"`
}

func GetPluginDashboards(orgId int64, pluginId string) ([]*PluginDashboardInfoDTO, error) {
	plugin, exists := Plugins[pluginId]

	if !exists {
		return nil, PluginNotFoundError{pluginId}
	}

	result := make([]*PluginDashboardInfoDTO, 0)

	for _, include := range plugin.Includes {
		if include.Type == PluginTypeDashboard {
			if dashInfo, err := getDashboardImportStatus(orgId, plugin, include.Path); err != nil {
				return nil, err
			} else {
				result = append(result, dashInfo)
			}
		}
	}

	return result, nil
}

func loadPluginDashboard(pluginId, path string) (*m.Dashboard, error) {
	plugin, exists := Plugins[pluginId]

	if !exists {
		return nil, PluginNotFoundError{pluginId}
	}

	dashboardFilePath := filepath.Join(plugin.PluginDir, path)
	reader, err := os.Open(dashboardFilePath)
	if err != nil {
		return nil, err
	}

	defer reader.Close()

	data, err := simplejson.NewFromReader(reader)
	if err != nil {
		return nil, err
	}

	return m.NewDashboardFromJson(data), nil
}

func getDashboardImportStatus(orgId int64, plugin *PluginBase, path string) (*PluginDashboardInfoDTO, error) {
	res := &PluginDashboardInfoDTO{}

	var dashboard *m.Dashboard
	var err error

	if dashboard, err = loadPluginDashboard(plugin.Id, path); err != nil {
		return nil, err
	}

	res.Path = path
	res.PluginId = plugin.Id
	res.Title = dashboard.Title
	res.Revision = dashboard.Data.Get("revision").MustInt64(1)

	query := m.GetDashboardQuery{OrgId: orgId, Slug: dashboard.Slug}

	if err := bus.Dispatch(&query); err != nil {
		if err != m.ErrDashboardNotFound {
			return nil, err
		}
	} else {
		res.Imported = true
		res.ImportedUri = "db/" + query.Result.Slug
		res.ImportedRevision = query.Result.Data.Get("revision").MustInt64(1)
	}

	return res, nil
}

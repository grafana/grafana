package plugins

import (
	"os"
	"path/filepath"

	"github.com/wangy1931/grafana/pkg/bus"
	"github.com/wangy1931/grafana/pkg/components/simplejson"
	m "github.com/wangy1931/grafana/pkg/models"
)

type PluginDashboardInfoDTO struct {
	PluginId          string `json:"pluginId"`
	Title             string `json:"title"`
	Installed         bool   `json:"installed"`
	InstalledUri      string `json:"installedUri"`
	InstalledRevision string `json:"installedRevision"`
	Revision          string `json:"revision"`
	Description       string `json:"description"`
	Path              string `json:"path"`
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

func loadPluginDashboard(plugin *PluginBase, path string) (*m.Dashboard, error) {

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

	if dashboard, err = loadPluginDashboard(plugin, path); err != nil {
		return nil, err
	}

	res.Path = path
	res.PluginId = plugin.Id
	res.Title = dashboard.Title
	res.Revision = dashboard.GetString("revision", "1.0")

	query := m.GetDashboardQuery{OrgId: orgId, Slug: dashboard.Slug}

	if err := bus.Dispatch(&query); err != nil {
		if err != m.ErrDashboardNotFound {
			return nil, err
		}
	} else {
		res.Installed = true
		res.InstalledUri = "db/" + query.Result.Slug
		res.InstalledRevision = query.Result.GetString("revision", "1.0")
	}

	return res, nil
}

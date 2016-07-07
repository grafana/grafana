package plugins

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func updateAppDashboards() {
	time.Sleep(time.Second * 1)

	plog.Debug("Looking for App Dashboard Updates")

	query := m.GetPluginSettingsQuery{OrgId: 0}

	if err := bus.Dispatch(&query); err != nil {
		plog.Error("Failed to get all plugin settings", "error", err)
		return
	}

	for _, pluginSetting := range query.Result {
		if appDef, exist := Apps[pluginSetting.PluginId]; exist {
			if appDef.Info.Version != pluginSetting.PluginVersion {
				handleAppPluginUpdated(appDef, pluginSetting.OrgId)
			}
		}
	}
}

func autoUpdateAppDashboard(pluginDashInfo *PluginDashboardInfoDTO, orgId int64) error {
	if dash, err := loadPluginDashboard(pluginDashInfo.PluginId, pluginDashInfo.Path); err != nil {
		return err
	} else {
		plog.Info("Auto updating App dashboard", "dashboard", dash.Title, "newRev", pluginDashInfo.Revision, "oldRev", pluginDashInfo.ImportedRevision)
		updateCmd := ImportDashboardCommand{
			OrgId:     orgId,
			PluginId:  pluginDashInfo.PluginId,
			Overwrite: true,
			Dashboard: dash.Data,
			UserId:    0,
			Path:      pluginDashInfo.Path,
		}

		if err := bus.Dispatch(&updateCmd); err != nil {
			return err
		}
	}
	return nil
}

func handleAppPluginUpdated(appDef *AppPlugin, orgId int64) {
	plog.Info("App update detected", "pluginId", appDef.Id)

	// Get plugin dashboards
	if dashboards, err := GetPluginDashboards(orgId, appDef.Id); err != nil {
		plog.Error("Failed to load app dashboards", "error", err)
		return
	} else {
		// Update dashboards with updated revisions
		for _, dash := range dashboards {
			if dash.ImportedRevision != dash.Revision {
				if err := autoUpdateAppDashboard(dash, orgId); err != nil {
					plog.Error("Failed to auto update app dashboard", "pluginId", appDef.Id, "error", err)
					return
				}
			}
		}
	}

	// update version in plugin_setting table to mark that we have processed the update
	query := m.GetPluginSettingByIdQuery{PluginId: appDef.Id, OrgId: orgId}
	if err := bus.Dispatch(&query); err != nil {
		plog.Error("Failed to read plugin setting by id", "error", err)
		return
	}

	appSetting := query.Result
	cmd := m.UpdatePluginSettingVersionCmd{
		OrgId:         appSetting.OrgId,
		PluginId:      appSetting.PluginId,
		PluginVersion: appDef.Info.Version,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		plog.Error("Failed to update plugin setting version", "error", err)
	}
}

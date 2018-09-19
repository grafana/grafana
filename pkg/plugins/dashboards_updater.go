package plugins

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddEventListener(handlePluginStateChanged)
}

func (pm *PluginManager) updateAppDashboards() {
	pm.log.Debug("Looking for App Dashboard Updates")

	query := m.GetPluginSettingsQuery{OrgId: 0}

	if err := bus.Dispatch(&query); err != nil {
		plog.Error("Failed to get all plugin settings", "error", err)
		return
	}

	for _, pluginSetting := range query.Result {
		// ignore disabled plugins
		if !pluginSetting.Enabled {
			continue
		}

		if pluginDef, exist := Plugins[pluginSetting.PluginId]; exist {
			if pluginDef.Info.Version != pluginSetting.PluginVersion {
				syncPluginDashboards(pluginDef, pluginSetting.OrgId)
			}
		}
	}
}

func autoUpdateAppDashboard(pluginDashInfo *PluginDashboardInfoDTO, orgId int64) error {
	dash, err := loadPluginDashboard(pluginDashInfo.PluginId, pluginDashInfo.Path)
	if err != nil {
		return err
	}
	plog.Info("Auto updating App dashboard", "dashboard", dash.Title, "newRev", pluginDashInfo.Revision, "oldRev", pluginDashInfo.ImportedRevision)
	updateCmd := ImportDashboardCommand{
		OrgId:     orgId,
		PluginId:  pluginDashInfo.PluginId,
		Overwrite: true,
		Dashboard: dash.Data,
		User:      &m.SignedInUser{UserId: 0, OrgRole: m.ROLE_ADMIN},
		Path:      pluginDashInfo.Path,
	}

	return bus.Dispatch(&updateCmd)
}

func syncPluginDashboards(pluginDef *PluginBase, orgId int64) {
	plog.Info("Syncing plugin dashboards to DB", "pluginId", pluginDef.Id)

	// Get plugin dashboards
	dashboards, err := GetPluginDashboards(orgId, pluginDef.Id)

	if err != nil {
		plog.Error("Failed to load app dashboards", "error", err)
		return
	}

	// Update dashboards with updated revisions
	for _, dash := range dashboards {
		// remove removed ones
		if dash.Removed {
			plog.Info("Deleting plugin dashboard", "pluginId", pluginDef.Id, "dashboard", dash.Slug)

			deleteCmd := m.DeleteDashboardCommand{OrgId: orgId, Id: dash.DashboardId}
			if err := bus.Dispatch(&deleteCmd); err != nil {
				plog.Error("Failed to auto update app dashboard", "pluginId", pluginDef.Id, "error", err)
				return
			}

			continue
		}

		// update updated ones
		if dash.ImportedRevision != dash.Revision {
			if err := autoUpdateAppDashboard(dash, orgId); err != nil {
				plog.Error("Failed to auto update app dashboard", "pluginId", pluginDef.Id, "error", err)
				return
			}
		}
	}

	// update version in plugin_setting table to mark that we have processed the update
	query := m.GetPluginSettingByIdQuery{PluginId: pluginDef.Id, OrgId: orgId}
	if err := bus.Dispatch(&query); err != nil {
		plog.Error("Failed to read plugin setting by id", "error", err)
		return
	}

	appSetting := query.Result
	cmd := m.UpdatePluginSettingVersionCmd{
		OrgId:         appSetting.OrgId,
		PluginId:      appSetting.PluginId,
		PluginVersion: pluginDef.Info.Version,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		plog.Error("Failed to update plugin setting version", "error", err)
	}
}

func handlePluginStateChanged(event *m.PluginStateChangedEvent) error {
	plog.Info("Plugin state changed", "pluginId", event.PluginId, "enabled", event.Enabled)

	if event.Enabled {
		syncPluginDashboards(Plugins[event.PluginId], event.OrgId)
	} else {
		query := m.GetDashboardsByPluginIdQuery{PluginId: event.PluginId, OrgId: event.OrgId}

		if err := bus.Dispatch(&query); err != nil {
			return err
		}
		for _, dash := range query.Result {
			deleteCmd := m.DeleteDashboardCommand{OrgId: dash.OrgId, Id: dash.Id}

			plog.Info("Deleting plugin dashboard", "pluginId", event.PluginId, "dashboard", dash.Slug)

			if err := bus.Dispatch(&deleteCmd); err != nil {
				return err
			}
		}
	}

	return nil
}

package manager

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
)

func (pm *PluginManager) GetPluginSettings(orgID int64) (map[string]*models.PluginSettingInfoDTO, error) {
	pluginSettings := make(map[string]*models.PluginSettingInfoDTO)

	// fill settings from database
	if pss, err := pm.SQLStore.GetPluginSettings(orgID); err != nil {
		return nil, err
	} else {
		for _, ps := range pss {
			pluginSettings[ps.PluginId] = ps
		}
	}

	// fill settings from app plugins
	for _, plugin := range pm.Apps() {
		// ignore settings that already exist
		if _, exists := pluginSettings[plugin.Id]; exists {
			continue
		}

		// add new setting which is enabled depending on if AutoEnabled: true
		pluginSetting := &models.PluginSettingInfoDTO{
			PluginId: plugin.Id,
			OrgId:    orgID,
			Enabled:  plugin.AutoEnabled,
			Pinned:   plugin.AutoEnabled,
		}

		pluginSettings[plugin.Id] = pluginSetting
	}

	// fill settings from all remaining plugins (including potential app child plugins)
	for _, plugin := range pm.Plugins() {
		// ignore settings that already exist
		if _, exists := pluginSettings[plugin.Id]; exists {
			continue
		}

		// add new setting which is enabled by default
		pluginSetting := &models.PluginSettingInfoDTO{
			PluginId: plugin.Id,
			OrgId:    orgID,
			Enabled:  true,
		}

		// if plugin is included in an app, check app settings
		if plugin.IncludedInAppId != "" {
			// app child plugins are disabled unless app is enabled
			pluginSetting.Enabled = false
			if p, exists := pluginSettings[plugin.IncludedInAppId]; exists {
				pluginSetting.Enabled = p.Enabled
			}
		}
		pluginSettings[plugin.Id] = pluginSetting
	}

	return pluginSettings, nil
}

func (pm *PluginManager) GetEnabledPlugins(orgID int64) (*plugins.EnabledPlugins, error) {
	enabledPlugins := &plugins.EnabledPlugins{
		Panels:      make([]*plugins.PanelPlugin, 0),
		DataSources: make(map[string]*plugins.DataSourcePlugin),
		Apps:        make([]*plugins.AppPlugin, 0),
	}

	pluginSettingMap, err := pm.GetPluginSettings(orgID)
	if err != nil {
		return enabledPlugins, err
	}

	for _, app := range pm.Apps() {
		if b, ok := pluginSettingMap[app.Id]; ok {
			app.Pinned = b.Pinned
			enabledPlugins.Apps = append(enabledPlugins.Apps, app)
		}
	}

	// add all plugins that are not part of an App.
	for dsID, ds := range pm.dataSources {
		if _, exists := pluginSettingMap[ds.Id]; exists {
			enabledPlugins.DataSources[dsID] = ds
		}
	}

	for _, panel := range pm.panels {
		if _, exists := pluginSettingMap[panel.Id]; exists {
			enabledPlugins.Panels = append(enabledPlugins.Panels, panel)
		}
	}

	return enabledPlugins, nil
}

// IsAppInstalled checks if an app plugin with provided plugin ID is installed.
func (pm *PluginManager) IsAppInstalled(pluginID string) bool {
	_, exists := pm.apps[pluginID]
	return exists
}

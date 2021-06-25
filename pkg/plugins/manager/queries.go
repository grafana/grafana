package manager

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
)

func (pm *PluginManager) GetPluginSettings(orgID int64) (map[string]*models.PluginSettingInfoDTO, error) {
	pluginSettings, err := pm.SQLStore.GetPluginSettings(orgID)
	if err != nil {
		return nil, err
	}

	pluginMap := make(map[string]*models.PluginSettingInfoDTO)
	for _, plug := range pluginSettings {
		pluginMap[plug.PluginId] = plug
	}

	for _, pluginDef := range pm.Plugins() {
		// ignore entries that exists
		if _, ok := pluginMap[pluginDef.Id]; ok {
			continue
		}

		// default to enabled true
		opt := &models.PluginSettingInfoDTO{
			PluginId: pluginDef.Id,
			OrgId:    orgID,
			Enabled:  true,
		}

		// apps are disabled by default unless autoEnabled: true
		if app, exists := pm.apps[pluginDef.Id]; exists {
			opt.Enabled = app.AutoEnabled
			opt.Pinned = app.AutoEnabled
		}

		// if it's included in app check app settings
		if pluginDef.IncludedInAppId != "" {
			// app components are by default disabled
			opt.Enabled = false

			if appSettings, ok := pluginMap[pluginDef.IncludedInAppId]; ok {
				opt.Enabled = appSettings.Enabled
			}
		}

		pluginMap[pluginDef.Id] = opt
	}

	return pluginMap, nil
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

package plugins

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func GetPluginSettings(orgId int64) (map[string]*m.PluginSetting, error) {
	query := m.GetPluginSettingsQuery{OrgId: orgId}

	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	pluginMap := make(map[string]*m.PluginSetting)
	for _, plug := range query.Result {
		pluginMap[plug.PluginId] = plug
	}

	return pluginMap, nil
}

func GetEnabledPlugins(orgId int64) (*EnabledPlugins, error) {
	enabledPlugins := NewEnabledPlugins()
	orgPlugins, err := GetPluginSettings(orgId)
	if err != nil {
		return nil, err
	}

	enabledApps := make(map[string]bool)

	for pluginId, app := range Apps {

		if b, ok := orgPlugins[pluginId]; ok {
			app.Enabled = b.Enabled
			app.Pinned = b.Pinned
		}

		if app.Enabled {
			enabledApps[pluginId] = true
			enabledPlugins.Apps = append(enabledPlugins.Apps, app)
		}
	}

	isPluginEnabled := func(appId string) bool {
		if appId == "" {
			return true
		}

		_, ok := enabledApps[appId]
		return ok
	}

	// add all plugins that are not part of an App.
	for dsId, ds := range DataSources {
		if isPluginEnabled(ds.IncludedInAppId) {
			enabledPlugins.DataSources[dsId] = ds
		}
	}

	for _, panel := range Panels {
		if isPluginEnabled(panel.IncludedInAppId) {
			enabledPlugins.Panels = append(enabledPlugins.Panels, panel)
		}
	}

	return &enabledPlugins, nil
}

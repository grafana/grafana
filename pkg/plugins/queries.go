package plugins

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func GetOrgAppSettings(orgId int64) (map[string]*m.AppSettings, error) {
	query := m.GetAppSettingsQuery{OrgId: orgId}

	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	orgAppsMap := make(map[string]*m.AppSettings)
	for _, orgApp := range query.Result {
		orgAppsMap[orgApp.AppId] = orgApp
	}

	return orgAppsMap, nil
}

func GetEnabledPlugins(orgId int64) (*EnabledPlugins, error) {
	enabledPlugins := NewEnabledPlugins()
	orgApps, err := GetOrgAppSettings(orgId)
	if err != nil {
		return nil, err
	}

	enabledApps := make(map[string]bool)

	for appId, installedApp := range Apps {
		var app AppPlugin
		app = *installedApp

		// check if the app is stored in the DB for this org and if so, use the
		// state stored there.
		if b, ok := orgApps[appId]; ok {
			app.Enabled = b.Enabled
			app.Pinned = b.Pinned
		}

		if app.Enabled {
			enabledApps[app.Id] = true
			enabledPlugins.Apps = append(enabledPlugins.Apps, &app)
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

	for _, api := range ApiPlugins {
		if isPluginEnabled(api.IncludedInAppId) {
			enabledPlugins.ApiList = append(enabledPlugins.ApiList, api)
		}
	}

	return &enabledPlugins, nil
}

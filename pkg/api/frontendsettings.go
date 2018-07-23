package api

import (
	"strconv"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func getFrontendSettingsMap(c *m.ReqContext) (map[string]interface{}, error) {
	orgDataSources := make([]*m.DataSource, 0)

	if c.OrgId != 0 {
		query := m.GetDataSourcesQuery{OrgId: c.OrgId}
		err := bus.Dispatch(&query)

		if err != nil {
			return nil, err
		}

		orgDataSources = query.Result
	}

	datasources := make(map[string]interface{})
	var defaultDatasource string

	enabledPlugins, err := plugins.GetEnabledPlugins(c.OrgId)
	if err != nil {
		return nil, err
	}

	for _, ds := range orgDataSources {
		url := ds.Url

		if ds.Access == m.DS_ACCESS_PROXY {
			url = "/api/datasources/proxy/" + strconv.FormatInt(ds.Id, 10)
		}

		var dsMap = map[string]interface{}{
			"id":   ds.Id,
			"type": ds.Type,
			"name": ds.Name,
			"url":  url,
		}

		meta, exists := enabledPlugins.DataSources[ds.Type]
		if !exists {
			log.Error(3, "Could not find plugin definition for data source: %v", ds.Type)
			continue
		}

		dsMap["meta"] = meta

		if ds.IsDefault {
			defaultDatasource = ds.Name
		}

		if ds.JsonData != nil {
			dsMap["jsonData"] = ds.JsonData
		} else {
			dsMap["jsonData"] = make(map[string]string)
		}

		if ds.Access == m.DS_ACCESS_DIRECT {
			if ds.BasicAuth {
				dsMap["basicAuth"] = util.GetBasicAuthHeader(ds.BasicAuthUser, ds.BasicAuthPassword)
			}
			if ds.WithCredentials {
				dsMap["withCredentials"] = ds.WithCredentials
			}

			if ds.Type == m.DS_INFLUXDB_08 {
				dsMap["username"] = ds.User
				dsMap["password"] = ds.Password
				dsMap["url"] = url + "/db/" + ds.Database
			}

			if ds.Type == m.DS_INFLUXDB {
				dsMap["username"] = ds.User
				dsMap["password"] = ds.Password
				dsMap["database"] = ds.Database
				dsMap["url"] = url
			}
		}

		if ds.Type == m.DS_ES {
			dsMap["index"] = ds.Database
		}

		if ds.Type == m.DS_INFLUXDB {
			dsMap["database"] = ds.Database
		}

		if ds.Type == m.DS_PROMETHEUS {
			// add unproxied server URL for link to Prometheus web UI
			dsMap["directUrl"] = ds.Url
		}

		datasources[ds.Name] = dsMap
	}

	// add datasources that are built in (meaning they are not added via data sources page, nor have any entry in datasource table)
	for _, ds := range plugins.DataSources {
		if ds.BuiltIn {
			datasources[ds.Name] = map[string]interface{}{
				"type": ds.Type,
				"name": ds.Name,
				"meta": plugins.DataSources[ds.Id],
			}
		}
	}

	if defaultDatasource == "" {
		defaultDatasource = "-- Grafana --"
	}

	panels := map[string]interface{}{}
	for _, panel := range enabledPlugins.Panels {
		panels[panel.Id] = map[string]interface{}{
			"module":       panel.Module,
			"baseUrl":      panel.BaseUrl,
			"name":         panel.Name,
			"id":           panel.Id,
			"info":         panel.Info,
			"hideFromList": panel.HideFromList,
			"sort":         getPanelSort(panel.Id),
		}
	}

	jsonObj := map[string]interface{}{
		"defaultDatasource":       defaultDatasource,
		"datasources":             datasources,
		"panels":                  panels,
		"appSubUrl":               setting.AppSubUrl,
		"allowOrgCreate":          (setting.AllowUserOrgCreate && c.IsSignedIn) || c.IsGrafanaAdmin,
		"authProxyEnabled":        setting.AuthProxyEnabled,
		"ldapEnabled":             setting.LdapEnabled,
		"alertingEnabled":         setting.AlertingEnabled,
		"exploreEnabled":          setting.ExploreEnabled,
		"googleAnalyticsId":       setting.GoogleAnalyticsId,
		"disableLoginForm":        setting.DisableLoginForm,
		"externalUserMngInfo":     setting.ExternalUserMngInfo,
		"externalUserMngLinkUrl":  setting.ExternalUserMngLinkUrl,
		"externalUserMngLinkName": setting.ExternalUserMngLinkName,
		"buildInfo": map[string]interface{}{
			"version":       setting.BuildVersion,
			"commit":        setting.BuildCommit,
			"buildstamp":    setting.BuildStamp,
			"latestVersion": plugins.GrafanaLatestVersion,
			"hasUpdate":     plugins.GrafanaHasUpdate,
			"env":           setting.Env,
			"isEnterprise":  setting.IsEnterprise,
		},
	}

	return jsonObj, nil
}

func getPanelSort(id string) int {
	sort := 100
	switch id {
	case "graph":
		sort = 1
	case "singlestat":
		sort = 2
	case "table":
		sort = 3
	case "text":
		sort = 4
	case "heatmap":
		sort = 5
	case "alertlist":
		sort = 6
	case "dashlist":
		sort = 7
	}
	return sort
}

func GetFrontendSettings(c *m.ReqContext) {
	settings, err := getFrontendSettingsMap(c)
	if err != nil {
		c.JsonApiErr(400, "Failed to get frontend settings", err)
		return
	}

	c.JSON(200, settings)
}

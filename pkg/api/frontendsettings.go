package api

import (
	"strconv"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
  "github.com/grafana/grafana/pkg/netcrunch"
)

func getFrontendSettingsMap(c *middleware.Context) (map[string]interface{}, error) {
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

	for _, ds := range orgDataSources {
		url := ds.Url

    var dsMap = map[string]interface{}{
      "type": ds.Type,
      "name": ds.Name,
      "url":  url,
    }

		if ds.Access == m.DS_ACCESS_PROXY {
			url = setting.AppSubUrl + "/api/datasources/proxy/" + strconv.FormatInt(ds.Id, 10)

      if ds.Type == m.DS_NETCRUNCH {
        dsMap["id"] = ds.Id
        dsMap["username"] = ds.User
        dsMap["password"] = ds.Password
        dsMap["url"] = url
      }
    }

		meta, exists := plugins.DataSources[ds.Type]
		if !exists {
			log.Error(3, "Could not find plugin definition for data source: %v", ds.Type)
			continue
		}

		dsMap["meta"] = meta

		if ds.IsDefault {
			defaultDatasource = ds.Name
		}

		if len(ds.JsonData) > 0 {
			dsMap["jsonData"] = ds.JsonData
		}

		if ds.Access == m.DS_ACCESS_DIRECT {
			if ds.BasicAuth {
				dsMap["basicAuth"] = util.GetBasicAuthHeader(ds.BasicAuthUser, ds.BasicAuthPassword)
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

      if ds.Type == m.DS_NETCRUNCH {
        dsMap["id"] = ds.Id
        dsMap["username"] = ds.User
        dsMap["password"] = ds.Password
        dsMap["url"] = url
      }
		}

		if ds.Type == m.DS_ES {
			dsMap["index"] = ds.Database
		}

		datasources[ds.Name] = dsMap
	}

	// add grafana backend data source
	grafanaDatasourceMeta, _ := plugins.DataSources["grafana"]
	datasources["grafana"] = map[string]interface{}{
		"type": "grafana",
		"meta": grafanaDatasourceMeta,
	}

  // add NetCrunch backend data source
  if (netcrunch.NetCrunchServerSettings.Enable == true) {
    netcrunchDatasourceMeta, _ := plugins.DataSources["netcrunch"]
    datasources["NetCrunch"] = map[string]interface{}{
      "type" : "netcrunch",
      "meta" : netcrunchDatasourceMeta,
    }

    defaultDatasource = "NetCrunch"
  }

	if defaultDatasource == "" {
		defaultDatasource = "grafana"
	}

	jsonObj := map[string]interface{}{
		"defaultDatasource": defaultDatasource,
		"datasources":       datasources,
		"appSubUrl":         setting.AppSubUrl,
		"allowOrgCreate":    (setting.AllowUserOrgCreate && c.IsSignedIn) || c.IsGrafanaAdmin,
		"buildInfo": map[string]interface{}{
			"version":    setting.BuildVersion,
			"commit":     setting.BuildCommit,
			"buildstamp": setting.BuildStamp,
		},
	}

	return jsonObj, nil
}

func GetFrontendSettings(c *middleware.Context) {
	settings, err := getFrontendSettingsMap(c)
	if err != nil {
		c.JsonApiErr(400, "Failed to get frontend settings", err)
		return
	}

	c.JSON(200, settings)
}

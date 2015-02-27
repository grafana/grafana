package api

import (
	"strconv"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func getFrontendSettingsMap(c *middleware.Context) (map[string]interface{}, error) {
	orgDataSources := make([]*m.DataSource, 0)

	if c.IsSignedIn {
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

		if ds.Access == m.DS_ACCESS_PROXY {
			url = setting.AppSubUrl + "/api/datasources/proxy/" + strconv.FormatInt(ds.Id, 10)
		}

		var dsMap = map[string]interface{}{
			"type": ds.Type,
			"url":  url,
		}

		if ds.IsDefault {
			defaultDatasource = ds.Name
		}

		if ds.Type == m.DS_INFLUXDB_08 {
			if ds.Access == m.DS_ACCESS_DIRECT {
				dsMap["username"] = ds.User
				dsMap["password"] = ds.Password
				dsMap["url"] = url + "/db/" + ds.Database
			}
		}

		if ds.Type == m.DS_INFLUXDB {
			if ds.Access == m.DS_ACCESS_DIRECT {
				dsMap["username"] = ds.User
				dsMap["password"] = ds.Password
				dsMap["database"] = ds.Database
				dsMap["url"] = url
			}
		}

		if ds.Type == m.DS_ES {
			dsMap["index"] = ds.Database
		}

		datasources[ds.Name] = dsMap
	}

	// add grafana backend data source
	datasources["grafana"] = map[string]interface{}{
		"type":      "grafana",
		"grafanaDB": true,
	}

	jsonObj := map[string]interface{}{
		"defaultDatasource": defaultDatasource,
		"datasources":       datasources,
		"appSubUrl":         setting.AppSubUrl,
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

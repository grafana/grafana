package api

import (
	"strconv"

	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/setting"
)

func getFrontendSettings(c *middleware.Context) (map[string]interface{}, error) {
	accountDataSources := make([]*m.DataSource, 0)

	if c.Account != nil {
		query := m.GetDataSourcesQuery{AccountId: c.Account.Id}
		err := bus.Dispatch(&query)

		if err != nil {
			return nil, err
		}

		accountDataSources = query.Result
	}

	datasources := make(map[string]interface{})

	for i, ds := range accountDataSources {
		url := ds.Url

		if ds.Access == m.DS_ACCESS_PROXY {
			url = setting.AppSubUrl + "/api/datasources/proxy/" + strconv.FormatInt(ds.Id, 10)
		}

		var dsMap = map[string]interface{}{
			"type": ds.Type,
			"url":  url,
		}

		if ds.Type == m.DS_INFLUXDB {
			if ds.Access == m.DS_ACCESS_DIRECT {
				dsMap["username"] = ds.User
				dsMap["password"] = ds.Password
				dsMap["url"] = url + "/db/" + ds.Database
			}
		}

		// temp hack, first is always default
		// TODO: implement default ds account setting
		if i == 0 {
			dsMap["default"] = true
		}

		datasources[ds.Name] = dsMap
	}

	// add grafana backend data source
	datasources["grafana"] = map[string]interface{}{
		"type":      "grafana",
		"grafanaDB": true,
	}

	jsonObj := map[string]interface{}{
		"datasources": datasources,
		"appSubUrl":   setting.AppSubUrl,
	}

	return jsonObj, nil
}

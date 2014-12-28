package api

import (
	"strconv"

	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func getFrontendSettings(accountId int64) (map[string]interface{}, error) {
	query := m.GetDataSourcesQuery{AccountId: accountId}
	err := bus.Dispatch(&query)

	if err != nil {
		return nil, err
	}

	datasources := make(map[string]interface{})

	for i, ds := range query.Result {
		url := ds.Url

		if ds.Access == m.DS_ACCESS_PROXY {
			url = "/api/datasources/proxy/" + strconv.FormatInt(ds.Id, 10)
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
		"url":       "",
		"grafanaDB": true,
	}

	jsonObj := map[string]interface{}{
		"datasources": datasources,
	}

	return jsonObj, nil
}

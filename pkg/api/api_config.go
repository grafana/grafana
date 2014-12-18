package api

import (
	"encoding/json"
	"strings"

	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

const configTemplate = `
	define(['settings'],
	function (Settings) {
		"use strict";
		return new Settings(%json%);
	});
	`

type configJsTmplModel struct {
	DataSources []*m.DataSource
}

func renderConfig(data *configJsTmplModel) string {
	datasources := make(map[string]interface{})

	for _, ds := range data.DataSources {
		url := ds.Url
		if ds.Access == m.DS_ACCESS_PROXY {
			url = "/api/datasources/proxy/" + ds.Name
		}
		datasources[ds.Name] = map[string]interface{}{
			"type": ds.Type,
			"url":  url,
		}
	}

	jsonObj := map[string]interface{}{
		"datasources": datasources,
	}

	buff, _ := json.Marshal(jsonObj)

	return strings.Replace(configTemplate, "%json%", string(buff), 1)
}

func GetConfigJS(c *middleware.Context) {

	query := m.GetDataSourcesQuery{AccountId: c.GetAccountId()}
	err := bus.Dispatch(&query)

	if err != nil {
		c.Handle(500, "cold not load data sources", err)
		return
	}

	vm := configJsTmplModel{DataSources: query.Result}
	configStr := renderConfig(&vm)

	if err != nil {
		c.Handle(500, "Failed to generate config.js", err)
		return
	}

	c.Header().Set("Content-Type", "text/javascript; charset=UTF-8")
	c.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header().Set("Pragma", "no-cache")
	c.Header().Set("Expires", "0")
	c.WriteHeader(200)

	c.Write([]byte(configStr))
}

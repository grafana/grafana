package api

import (
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func GetDataSources(c *middleware.Context) {
	query := m.GetDataSourcesQuery{AccountId: c.Account.Id}
	err := bus.Dispatch(&query)

	if err != nil {
		c.JsonApiErr(500, "Failed to query datasources", err)
		return
	}
}

func AddDataSource(c *middleware.Context) {
	cmd := m.AddDataSourceCommand{}

	if !c.JsonBody(&cmd) {
		c.JsonApiErr(400, "bad request", nil)
		return
	}

	err := bus.Dispatch(&cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to add datasource", err)
		return
	}

	c.Status(204)
}

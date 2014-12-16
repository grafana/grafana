package api

import (
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func GetDataSources(c *middleware.Context) {
	query := m.GetDataSourcesQuery{AccountId: c.Account.Id}
	err := bus.SendQuery(&query)

	if err != nil {
		c.JsonApiErr(500, "Failed to query datasources", err)
		return
	}
}

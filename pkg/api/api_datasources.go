package api

import (
	"github.com/torkelo/grafana-pro/pkg/api/dtos"
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

	result := make([]*dtos.DataSource, len(query.Resp))
	for _, ds := range query.Resp {
		result = append(result, &dtos.DataSource{
			Id:        ds.Id,
			AccountId: ds.AccountId,
			Name:      ds.Name,
			Url:       ds.Url,
			Type:      ds.Type,
			Access:    ds.Access,
			Password:  ds.Password,
			User:      ds.User,
			BasicAuth: ds.BasicAuth,
		})
	}

	c.JSON(200, result)
}

func AddDataSource(c *middleware.Context) {
	cmd := m.AddDataSourceCommand{}

	if !c.JsonBody(&cmd) {
		c.JsonApiErr(400, "Validation failed", nil)
		return
	}

	cmd.AccountId = c.Account.Id

	err := bus.Dispatch(&cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to add datasource", err)
		return
	}

	c.JsonOK("Datasource added")
}

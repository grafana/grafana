package api

import (
	"github.com/torkelo/grafana-pro/pkg/api/dtos"
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func GetDataSources(c *middleware.Context) {
	query := m.GetDataSourcesQuery{AccountId: c.AccountId}
	err := bus.Dispatch(&query)

	if err != nil {
		c.JsonApiErr(500, "Failed to query datasources", err)
		return
	}

	result := make([]*dtos.DataSource, len(query.Result))
	for i, ds := range query.Result {
		result[i] = &dtos.DataSource{
			Id:        ds.Id,
			AccountId: ds.AccountId,
			Name:      ds.Name,
			Url:       ds.Url,
			Type:      ds.Type,
			Access:    ds.Access,
			Password:  ds.Password,
			Database:  ds.Database,
			User:      ds.User,
			BasicAuth: ds.BasicAuth,
			IsDefault: ds.IsDefault,
		}
	}

	c.JSON(200, result)
}

func DeleteDataSource(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	if id <= 0 {
		c.JsonApiErr(400, "Missing valid datasource id", nil)
		return
	}

	cmd := &m.DeleteDataSourceCommand{Id: id, AccountId: c.AccountId}

	err := bus.Dispatch(cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to delete datasource", err)
		return
	}

	c.JsonOK("Data source deleted")
}

func AddDataSource(c *middleware.Context) {
	cmd := m.AddDataSourceCommand{}

	if !c.JsonBody(&cmd) {
		c.JsonApiErr(400, "Validation failed", nil)
		return
	}

	cmd.AccountId = c.AccountId

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to add datasource", err)
		return
	}

	c.JsonOK("Datasource added")
}

func UpdateDataSource(c *middleware.Context) {
	cmd := m.UpdateDataSourceCommand{}

	if !c.JsonBody(&cmd) {
		c.JsonApiErr(400, "Validation failed", nil)
		return
	}

	cmd.AccountId = c.AccountId

	err := bus.Dispatch(&cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to update datasource", err)
		return
	}

	c.JsonOK("Datasource updated")
}

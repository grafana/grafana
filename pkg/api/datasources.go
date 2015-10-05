package api

import (
	"github.com/Cepave/grafana/pkg/api/dtos"
	"github.com/Cepave/grafana/pkg/bus"
	"github.com/Cepave/grafana/pkg/middleware"
	m "github.com/Cepave/grafana/pkg/models"
	"github.com/Cepave/grafana/pkg/plugins"
	"github.com/Cepave/grafana/pkg/util"
)

func GetDataSources(c *middleware.Context) {
	query := m.GetDataSourcesQuery{OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to query datasources", err)
		return
	}

	result := make([]*dtos.DataSource, len(query.Result))
	for i, ds := range query.Result {
		result[i] = &dtos.DataSource{
			Id:        ds.Id,
			OrgId:     ds.OrgId,
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

func GetDataSourceById(c *middleware.Context) {
	query := m.GetDataSourceByIdQuery{
		Id:    c.ParamsInt64(":id"),
		OrgId: c.OrgId,
	}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to query datasources", err)
		return
	}

	ds := query.Result

	c.JSON(200, &dtos.DataSource{
		Id:                ds.Id,
		OrgId:             ds.OrgId,
		Name:              ds.Name,
		Url:               ds.Url,
		Type:              ds.Type,
		Access:            ds.Access,
		Password:          ds.Password,
		Database:          ds.Database,
		User:              ds.User,
		BasicAuth:         ds.BasicAuth,
		BasicAuthUser:     ds.BasicAuthUser,
		BasicAuthPassword: ds.BasicAuthPassword,
		IsDefault:         ds.IsDefault,
		JsonData:          ds.JsonData,
	})
}

func DeleteDataSource(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	if id <= 0 {
		c.JsonApiErr(400, "Missing valid datasource id", nil)
		return
	}

	cmd := &m.DeleteDataSourceCommand{Id: id, OrgId: c.OrgId}

	err := bus.Dispatch(cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to delete datasource", err)
		return
	}

	c.JsonOK("Data source deleted")
}

func AddDataSource(c *middleware.Context, cmd m.AddDataSourceCommand) {
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to add datasource", err)
		return
	}

	c.JSON(200, util.DynMap{"message": "Datasource added", "id": cmd.Result.Id})
}

func UpdateDataSource(c *middleware.Context, cmd m.UpdateDataSourceCommand) {
	cmd.OrgId = c.OrgId
	cmd.Id = c.ParamsInt64(":id")

	err := bus.Dispatch(&cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to update datasource", err)
		return
	}

	c.JsonOK("Datasource updated")
}

func GetDataSourcePlugins(c *middleware.Context) {
	c.JSON(200, plugins.DataSources)
}

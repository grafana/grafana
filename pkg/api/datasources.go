package api

import (
	"sort"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/plugins"
	//"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

func GetDataSources(c *middleware.Context) {
	query := m.GetDataSourcesQuery{OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to query datasources", err)
		return
	}

	result := make(dtos.DataSourceList, 0)
	for _, ds := range query.Result {

		dsItem := dtos.DataSource{
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

		if plugin, exists := plugins.DataSources[ds.Type]; exists {
			dsItem.TypeLogoUrl = plugin.Info.Logos.Small
		} else {
			dsItem.TypeLogoUrl = "public/img/icn-datasource.svg"
		}

		result = append(result, dsItem)
	}

	sort.Sort(result)
	c.JSON(200, result)
}

func GetDataSourceById(c *middleware.Context) Response {
	query := m.GetDataSourceByIdQuery{
		Id:    c.ParamsInt64(":id"),
		OrgId: c.OrgId,
	}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrDataSourceNotFound {
			return ApiError(404, "Data source not found", nil)
		}
		return ApiError(500, "Failed to query datasources", err)
	}

	ds := query.Result
	dtos := convertModelToDtos(ds)

	return Json(200, &dtos)
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

// Get /api/datasources/name/:name
func GetDataSourceByName(c *middleware.Context) Response {
	query := m.GetDataSourceByNameQuery{Name: c.Params(":name"), OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrDataSourceNotFound {
			return ApiError(404, "Data source not found", nil)
		}
		return ApiError(500, "Failed to query datasources", err)
	}

	ds := query.Result
	dtos := convertModelToDtos(ds)

	return Json(200, &dtos)
}

// Get /api/datasources/id/:name
func GetDataSourceIdByName(c *middleware.Context) Response {
	query := m.GetDataSourceByNameQuery{Name: c.Params(":name"), OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrDataSourceNotFound {
			return ApiError(404, "Data source not found", nil)
		}
		return ApiError(500, "Failed to query datasources", err)
	}

	ds := query.Result
	dtos := dtos.AnyId{
		Id: ds.Id,
	}

	return Json(200, &dtos)
}

func convertModelToDtos(ds m.DataSource) dtos.DataSource {
	return dtos.DataSource{
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
		WithCredentials:   ds.WithCredentials,
		IsDefault:         ds.IsDefault,
		JsonData:          ds.JsonData,
	}
}

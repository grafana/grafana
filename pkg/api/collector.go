package api

import (
	"github.com/grafana/grafana/pkg/bus"
	//"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

func GetCollectors(c *middleware.Context, query m.GetCollectorsQuery) Response {
	query.OrgId = c.OrgId

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to query collectors", err)
	}
	return Json(200, query.Result)
}

func getCollectorHealthById(c *middleware.Context) Response {
	id := c.ParamsInt64(":id")
	query := m.GetCollectorHealthByIdQuery{
		Id:    id,
		OrgId: c.OrgId,
	}
	err := bus.Dispatch(&query)
	if err != nil {
		return ApiError(500, "Failed to query collector health", err)
	}

	return Json(200, query.Result)
}

func GetCollectorById(c *middleware.Context) Response {
	id := c.ParamsInt64(":id")

	query := m.GetCollectorByIdQuery{Id: id, OrgId: c.OrgId}
	err := bus.Dispatch(&query)
	if err != nil {
		return ApiError(404, "Collector not found", nil)
	}

	return Json(200, query.Result)
}

func DeleteCollector(c *middleware.Context) Response {
	id := c.ParamsInt64(":id")

	cmd := &m.DeleteCollectorCommand{Id: id, OrgId: c.OrgId}

	err := bus.Dispatch(cmd)
	if err != nil {
		return ApiError(500, "Failed to delete collector", err)
	}

	return ApiSuccess("collector deleted")
}

func AddCollector(c *middleware.Context, cmd m.AddCollectorCommand) Response {
	cmd.OrgId = c.OrgId

	if cmd.Public {
		if !c.IsGrafanaAdmin {
			return ApiError(400, "Only admins can make public collectors", nil)
		}
	}
	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to add collector", err)
	}

	return Json(200, cmd.Result)
}

func UpdateCollector(c *middleware.Context, cmd m.UpdateCollectorCommand) Response {
	cmd.OrgId = c.OrgId

	err := bus.Dispatch(&cmd)
	if err != nil {
		return ApiError(500, "Failed to update collector", err)
	}

	return ApiSuccess("Collector updated")
}

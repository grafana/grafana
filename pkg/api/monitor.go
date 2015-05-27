package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

func GetMonitorById(c *middleware.Context) Response {
	id := c.ParamsInt64(":id")

	query := m.GetMonitorByIdQuery{Id: id, OrgId: c.OrgId}
	query.IsGrafanaAdmin = c.IsGrafanaAdmin

	err := bus.Dispatch(&query)
	if err != nil {
		return ApiError(404, "Monitor not found", nil)
	}

	return Json(200, query.Result)
}

func getMonitorHealthById(c *middleware.Context) Response {
	id := c.ParamsInt64(":id")
	query := m.GetMonitorHealthByIdQuery{
		Id:    id,
		OrgId: c.OrgId,
	}
	err := bus.Dispatch(&query)
	if err != nil {
		return ApiError(500, "Failed to query monitor health", err)
	}

	return Json(200, query.Result)
}

func GetMonitors(c *middleware.Context, query m.GetMonitorsQuery) Response {
	query.OrgId = c.OrgId
	query.IsGrafanaAdmin = c.IsGrafanaAdmin

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to query monitors", err)
	}
	return Json(200, query.Result)
}

func GetMonitorTypes(c *middleware.Context) Response {
	query := m.GetMonitorTypesQuery{}
	err := bus.Dispatch(&query)

	if err != nil {
		return ApiError(500, "Failed to query monitor_types", err)
	}
	return Json(200, query.Result)
}

func DeleteMonitor(c *middleware.Context) Response {
	id := c.ParamsInt64(":id")

	cmd := &m.DeleteMonitorCommand{Id: id, OrgId: c.OrgId}

	err := bus.Dispatch(cmd)
	if err != nil {
		return ApiError(500, "Failed to delete monitor", err)
	}

	return ApiSuccess("monitor deleted")
}

func AddMonitor(c *middleware.Context, cmd m.AddMonitorCommand) Response {
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to add monitor", err)
	}

	return Json(200, cmd.Result)
}

func UpdateMonitor(c *middleware.Context, cmd m.UpdateMonitorCommand) Response {
	cmd.OrgId = c.OrgId

	err := bus.Dispatch(&cmd)
	if err != nil {
		return ApiError(500, "Failed to update monitor", err)
	}

	return ApiSuccess("Monitor updated")
}

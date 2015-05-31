package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	_ "github.com/grafana/grafana/pkg/services/endpointdiscovery"
)

func GetEndpointById(c *middleware.Context) Response {
	id := c.ParamsInt64(":id")

	query := m.GetEndpointByIdQuery{Id: id, OrgId: c.OrgId}

	err := bus.Dispatch(&query)
	if err != nil {
		return ApiError(404, "Endpoint not found", nil)
	}

	return Json(200, query.Result)
}

func getEndpointHealthById(c *middleware.Context) Response {
	id := c.ParamsInt64(":id")
	query := m.GetEndpointHealthByIdQuery{
		Id:    id,
		OrgId: c.OrgId,
	}
	err := bus.Dispatch(&query)
	if err != nil {
		return ApiError(500, "Failed to query endpoint health", err)
	}

	return Json(200, query.Result)
}

func GetEndpoints(c *middleware.Context, query m.GetEndpointsQuery) Response {
	query.OrgId = c.OrgId

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to query endpoints", err)
	}
	return Json(200, query.Result)
}

func DeleteEndpoint(c *middleware.Context) Response {
	id := c.ParamsInt64(":id")

	cmd := &m.DeleteEndpointCommand{Id: id, OrgId: c.OrgId}

	err := bus.Dispatch(cmd)
	if err != nil {
		return ApiError(500, "Failed to delete endpoint", err)
	}

	return ApiSuccess("endpoint deleted")
}

func AddEndpoint(c *middleware.Context, cmd m.AddEndpointCommand) Response {
	cmd.OrgId = c.OrgId
	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to add endpoint", err)
	}

	return Json(200, cmd.Result)
}

func UpdateEndpoint(c *middleware.Context, cmd m.UpdateEndpointCommand) Response {
	cmd.OrgId = c.OrgId

	err := bus.Dispatch(&cmd)
	if err != nil {
		return ApiError(500, "Failed to update endpoint", err)
	}

	return ApiSuccess("Endpoint updated")
}

func DiscoverEndpoint(c *middleware.Context, cmd m.EndpointDiscoveryCommand) Response {
	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to discover endpoint", err)
	}
	return Json(200, cmd.Result)
}

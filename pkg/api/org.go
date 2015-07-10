package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// GET /api/org
func GetOrgCurrent(c *middleware.Context) Response {
	return getOrgHelper(c.OrgId)
}

// GET /api/orgs/:orgId
func GetOrgById(c *middleware.Context) Response {
	return getOrgHelper(c.ParamsInt64(":orgId"))
}

func getOrgHelper(orgId int64) Response {
	query := m.GetOrgByIdQuery{Id: orgId}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrOrgNotFound {
			return ApiError(404, "Organization not found", err)
		}

		return ApiError(500, "Failed to get organization", err)
	}

	org := m.OrgDTO{
		Id:   query.Result.Id,
		Name: query.Result.Name,
	}

	return Json(200, &org)
}

// POST /api/orgs
func CreateOrg(c *middleware.Context, cmd m.CreateOrgCommand) Response {
	if !c.IsSignedIn || (!setting.AllowUserOrgCreate && !c.IsGrafanaAdmin) {
		return ApiError(401, "Access denied", nil)
	}

	cmd.UserId = c.UserId
	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to create organization", err)
	}

	metrics.M_Api_Org_Create.Inc(1)

	return Json(200, &util.DynMap{
		"orgId":   cmd.Result.Id,
		"message": "Organization created",
	})
}

// PUT /api/org
func UpdateOrgCurrent(c *middleware.Context, cmd m.UpdateOrgCommand) Response {
	cmd.OrgId = c.OrgId
	return updateOrgHelper(cmd)
}

// PUT /api/orgs/:orgId
func UpdateOrg(c *middleware.Context, cmd m.UpdateOrgCommand) Response {
	cmd.OrgId = c.ParamsInt64(":orgId")
	return updateOrgHelper(cmd)
}

func updateOrgHelper(cmd m.UpdateOrgCommand) Response {
	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to update organization", err)
	}

	return ApiSuccess("Organization updated")
}

func SearchOrgs(c *middleware.Context) Response {
	query := m.SearchOrgsQuery{
		Query: c.Query("query"),
		Name:  c.Query("name"),
		Page:  0,
		Limit: 1000,
	}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to search orgs", err)
	}

	return Json(200, query.Result)
}

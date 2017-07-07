package api

import (
	"github.com/wangy1931/grafana/pkg/api/dtos"
	"github.com/wangy1931/grafana/pkg/bus"
	"github.com/wangy1931/grafana/pkg/metrics"
	"github.com/wangy1931/grafana/pkg/middleware"
	m "github.com/wangy1931/grafana/pkg/models"
	"github.com/wangy1931/grafana/pkg/services/sqlstore"
	"github.com/wangy1931/grafana/pkg/setting"
	"github.com/wangy1931/grafana/pkg/util"
)

// GET /api/org
func GetOrgCurrent(c *middleware.Context) Response {
	return getOrgHelper(c.OrgId)
}

// GET /api/orgs/:orgId
func GetOrgById(c *middleware.Context) Response {
	return getOrgHelper(c.ParamsInt64(":orgId"))
}

// Get /api/orgs/name/:name
func GetOrgByName(c *middleware.Context) Response {
	query := m.GetOrgByNameQuery{Name: c.Params(":name")}
	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrOrgNotFound {
			return ApiError(404, "Organization not found", err)
		}

		return ApiError(500, "Failed to get organization", err)
	}
	org := query.Result
	result := m.OrgDetailsDTO{
		Id:   org.Id,
		Name: org.Name,
		Address: m.Address{
			Address1: org.Address1,
			Address2: org.Address2,
			City:     org.City,
			ZipCode:  org.ZipCode,
			State:    org.State,
			Country:  org.Country,
		},
	}

	return Json(200, &result)
}

func getOrgHelper(orgId int64) Response {
	query := m.GetOrgByIdQuery{Id: orgId}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrOrgNotFound {
			return ApiError(404, "Organization not found", err)
		}

		return ApiError(500, "Failed to get organization", err)
	}

  	org := query.Result.Org
	result := m.OrgDetailsDTO{
		Id:   org.Id,
		Name: org.Name,
		Address: m.Address{
			Address1: org.Address1,
			Address2: org.Address2,
			City:     org.City,
			ZipCode:  org.ZipCode,
			State:    org.State,
			Country:  org.Country,
		},
    		Systems: query.Result.Systems,
	}

	return Json(200, &result)
}

// POST /api/orgs
func CreateOrg(c *middleware.Context, cmd m.CreateOrgCommand) Response {
	if !c.IsSignedIn || (!setting.AllowUserOrgCreate && !c.IsGrafanaAdmin) {
		return ApiError(403, "Access denied", nil)
	}

	cmd.UserId = c.UserId
	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrOrgNameTaken {
			return ApiError(409, "Organization name taken", err)
		}
		return ApiError(500, "Failed to create organization", err)
	}

	metrics.M_Api_Org_Create.Inc(1)

	// We need to add the data source defined in config for this org to data_source table
	if err := sqlstore.AddDatasourceForOrg(cmd.Result.Id); err != nil {
		return ApiError(500, "Failed to add data source for organization", err)
	}

	return Json(200, &util.DynMap{
		"orgId":   cmd.Result.Id,
		"message": "Organization created",
	})
}

// PUT /api/org
func UpdateOrgCurrent(c *middleware.Context, form dtos.UpdateOrgForm) Response {
	return updateOrgHelper(form, c.OrgId)
}

// PUT /api/orgs/:orgId
func UpdateOrg(c *middleware.Context, form dtos.UpdateOrgForm) Response {
	return updateOrgHelper(form, c.ParamsInt64(":orgId"))
}

func updateOrgHelper(form dtos.UpdateOrgForm, orgId int64) Response {
	cmd := m.UpdateOrgCommand{Name: form.Name, OrgId: orgId}
	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrOrgNameTaken {
			return ApiError(400, "Organization name taken", err)
		}
		return ApiError(500, "Failed to update organization", err)
	}

	return ApiSuccess("Organization updated")
}

// PUT /api/org/address
func UpdateOrgAddressCurrent(c *middleware.Context, form dtos.UpdateOrgAddressForm) Response {
	return updateOrgAddressHelper(form, c.OrgId)
}

// PUT /api/orgs/:orgId/address
func UpdateOrgAddress(c *middleware.Context, form dtos.UpdateOrgAddressForm) Response {
	return updateOrgAddressHelper(form, c.ParamsInt64(":orgId"))
}

func updateOrgAddressHelper(form dtos.UpdateOrgAddressForm, orgId int64) Response {
	cmd := m.UpdateOrgAddressCommand{
		OrgId: orgId,
		Address: m.Address{
			Address1: form.Address1,
			Address2: form.Address2,
			City:     form.City,
			State:    form.State,
			ZipCode:  form.ZipCode,
			Country:  form.Country,
		},
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to update org address", err)
	}

	return ApiSuccess("Address updated")
}

// GET /api/orgs/:orgId
func DeleteOrgById(c *middleware.Context) Response {
	// We need to remove all the users in the org before deleting the org
	if err := bus.Dispatch(&m.DeleteAllUserInOrgCommand{OrgId: c.ParamsInt64(":orgId")}); err != nil {
		return ApiError(500, "Failed to delete all users in the organization", err)
	}

	// We also need to delete the data source for this org from data_source table
	if err := sqlstore.DeleteDatasourceForOrg(c.ParamsInt64(":orgId")); err != nil {
		return ApiError(500, "Failed to add data source for organization", err)
	}

	if err := bus.Dispatch(&m.DeleteOrgCommand{Id: c.ParamsInt64(":orgId")}); err != nil {
		return ApiError(500, "Failed to update organization", err)
	}

	return ApiSuccess("Organization deleted")
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

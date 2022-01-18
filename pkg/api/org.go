package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// GET /api/org
func GetCurrentOrg(c *models.ReqContext) response.Response {
	return getOrgHelper(c.Req.Context(), c.OrgId)
}

// GET /api/orgs/:orgId
func GetOrgByID(c *models.ReqContext) response.Response {
	orgId, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}
	return getOrgHelper(c.Req.Context(), orgId)
}

// GET /api/orgs/name/:name
func (hs *HTTPServer) GetOrgByName(c *models.ReqContext) response.Response {
	org, err := hs.SQLStore.GetOrgByName(web.Params(c.Req)[":name"])
	if err != nil {
		if errors.Is(err, models.ErrOrgNotFound) {
			return response.Error(404, "Organization not found", err)
		}

		return response.Error(500, "Failed to get organization", err)
	}
	result := models.OrgDetailsDTO{
		Id:   org.Id,
		Name: org.Name,
		Address: models.Address{
			Address1: org.Address1,
			Address2: org.Address2,
			City:     org.City,
			ZipCode:  org.ZipCode,
			State:    org.State,
			Country:  org.Country,
		},
	}

	return response.JSON(200, &result)
}

func getOrgHelper(ctx context.Context, orgID int64) response.Response {
	query := models.GetOrgByIdQuery{Id: orgID}

	if err := sqlstore.GetOrgById(ctx, &query); err != nil {
		if errors.Is(err, models.ErrOrgNotFound) {
			return response.Error(404, "Organization not found", err)
		}
		return response.Error(500, "Failed to get organization", err)
	}

	org := query.Result
	result := models.OrgDetailsDTO{
		Id:   org.Id,
		Name: org.Name,
		Address: models.Address{
			Address1: org.Address1,
			Address2: org.Address2,
			City:     org.City,
			ZipCode:  org.ZipCode,
			State:    org.State,
			Country:  org.Country,
		},
	}

	return response.JSON(200, &result)
}

// POST /api/orgs
func (hs *HTTPServer) CreateOrg(c *models.ReqContext) response.Response {
	cmd := models.CreateOrgCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	acEnabled := hs.Cfg.FeatureToggles["accesscontrol"]
	if !acEnabled && !(setting.AllowUserOrgCreate || c.IsGrafanaAdmin) {
		return response.Error(403, "Access denied", nil)
	}

	cmd.UserId = c.UserId
	if err := sqlstore.CreateOrg(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, models.ErrOrgNameTaken) {
			return response.Error(409, "Organization name taken", err)
		}
		return response.Error(500, "Failed to create organization", err)
	}

	metrics.MApiOrgCreate.Inc()

	return response.JSON(200, &util.DynMap{
		"orgId":   cmd.Result.Id,
		"message": "Organization created",
	})
}

// PUT /api/org
func UpdateCurrentOrg(c *models.ReqContext) response.Response {
	form := dtos.UpdateOrgForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	return updateOrgHelper(c.Req.Context(), form, c.OrgId)
}

// PUT /api/orgs/:orgId
func UpdateOrg(c *models.ReqContext) response.Response {
	form := dtos.UpdateOrgForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	orgId, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}
	return updateOrgHelper(c.Req.Context(), form, orgId)
}

func updateOrgHelper(ctx context.Context, form dtos.UpdateOrgForm, orgID int64) response.Response {
	cmd := models.UpdateOrgCommand{Name: form.Name, OrgId: orgID}
	if err := sqlstore.UpdateOrg(ctx, &cmd); err != nil {
		if errors.Is(err, models.ErrOrgNameTaken) {
			return response.Error(400, "Organization name taken", err)
		}
		return response.Error(500, "Failed to update organization", err)
	}

	return response.Success("Organization updated")
}

// PUT /api/org/address
func UpdateCurrentOrgAddress(c *models.ReqContext) response.Response {
	form := dtos.UpdateOrgAddressForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	return updateOrgAddressHelper(c.Req.Context(), form, c.OrgId)
}

// PUT /api/orgs/:orgId/address
func UpdateOrgAddress(c *models.ReqContext) response.Response {
	form := dtos.UpdateOrgAddressForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	orgId, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}
	return updateOrgAddressHelper(c.Req.Context(), form, orgId)
}

func updateOrgAddressHelper(ctx context.Context, form dtos.UpdateOrgAddressForm, orgID int64) response.Response {
	cmd := models.UpdateOrgAddressCommand{
		OrgId: orgID,
		Address: models.Address{
			Address1: form.Address1,
			Address2: form.Address2,
			City:     form.City,
			State:    form.State,
			ZipCode:  form.ZipCode,
			Country:  form.Country,
		},
	}

	if err := sqlstore.UpdateOrgAddress(ctx, &cmd); err != nil {
		return response.Error(500, "Failed to update org address", err)
	}

	return response.Success("Address updated")
}

// DELETE /api/orgs/:orgId
func DeleteOrgByID(c *models.ReqContext) response.Response {
	orgID, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}
	// before deleting an org, check if user does not belong to the current org
	if c.OrgId == orgID {
		return response.Error(400, "Can not delete org for current user", nil)
	}

	if err := sqlstore.DeleteOrg(c.Req.Context(), &models.DeleteOrgCommand{Id: orgID}); err != nil {
		if errors.Is(err, models.ErrOrgNotFound) {
			return response.Error(404, "Failed to delete organization. ID not found", nil)
		}
		return response.Error(500, "Failed to update organization", err)
	}
	return response.Success("Organization deleted")
}

func SearchOrgs(c *models.ReqContext) response.Response {
	perPage := c.QueryInt("perpage")
	if perPage <= 0 {
		perPage = 1000
	}

	page := c.QueryInt("page")

	query := models.SearchOrgsQuery{
		Query: c.Query("query"),
		Name:  c.Query("name"),
		Page:  page,
		Limit: perPage,
	}

	if err := sqlstore.SearchOrgs(c.Req.Context(), &query); err != nil {
		return response.Error(500, "Failed to search orgs", err)
	}

	return response.JSON(200, query.Result)
}

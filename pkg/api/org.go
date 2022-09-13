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
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// swagger:route GET /org org getCurrentOrg
//
// Get current Organization.
//
// Responses:
// 200: getCurrentOrgResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetCurrentOrg(c *models.ReqContext) response.Response {
	return hs.getOrgHelper(c.Req.Context(), c.OrgID)
}

// swagger:route GET /orgs/{org_id} orgs getOrgByID
//
// Get Organization by ID.
//
// Security:
// - basic:
//
// Responses:
// 200: getOrgByIDResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetOrgByID(c *models.ReqContext) response.Response {
	orgId, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}
	return hs.getOrgHelper(c.Req.Context(), orgId)
}

// swagger:route GET /orgs/name/{org_name} orgs getOrgByName
//
// Get Organization by ID.
//
// Security:
// - basic:
//
// Responses:
// 200: getOrgByNameResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetOrgByName(c *models.ReqContext) response.Response {
	org, err := hs.SQLStore.GetOrgByName(web.Params(c.Req)[":name"])
	if err != nil {
		if errors.Is(err, models.ErrOrgNotFound) {
			return response.Error(http.StatusNotFound, "Organization not found", err)
		}

		return response.Error(http.StatusInternalServerError, "Failed to get organization", err)
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

	return response.JSON(http.StatusOK, &result)
}

func (hs *HTTPServer) getOrgHelper(ctx context.Context, orgID int64) response.Response {
	query := models.GetOrgByIdQuery{Id: orgID}

	if err := hs.SQLStore.GetOrgById(ctx, &query); err != nil {
		if errors.Is(err, models.ErrOrgNotFound) {
			return response.Error(http.StatusNotFound, "Organization not found", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to get organization", err)
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

	return response.JSON(http.StatusOK, &result)
}

// swagger:route POST /orgs orgs createOrg
//
// Create Organization.
//
// Only works if [users.allow_org_create](https://grafana.com/docs/grafana/latest/administration/configuration/#allow_org_create) is set.
//
// Responses:
// 200: createOrgResponse
// 401: unauthorisedError
// 403: forbiddenError
// 409: conflictError
// 500: internalServerError
func (hs *HTTPServer) CreateOrg(c *models.ReqContext) response.Response {
	cmd := models.CreateOrgCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	acEnabled := !hs.AccessControl.IsDisabled()
	if !acEnabled && !(setting.AllowUserOrgCreate || c.IsGrafanaAdmin) {
		return response.Error(http.StatusForbidden, "Access denied", nil)
	}

	cmd.UserId = c.UserID
	if err := hs.SQLStore.CreateOrg(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, models.ErrOrgNameTaken) {
			return response.Error(http.StatusConflict, "Organization name taken", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to create organization", err)
	}

	metrics.MApiOrgCreate.Inc()

	return response.JSON(http.StatusOK, &util.DynMap{
		"orgId":   cmd.Result.Id,
		"message": "Organization created",
	})
}

// swagger:route PUT /org org updateCurrentOrg
//
// Update current Organization.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) UpdateCurrentOrg(c *models.ReqContext) response.Response {
	form := dtos.UpdateOrgForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	return hs.updateOrgHelper(c.Req.Context(), form, c.OrgID)
}

// swagger:route PUT /orgs/{org_id} orgs updateOrg
//
// Update Organization.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) UpdateOrg(c *models.ReqContext) response.Response {
	form := dtos.UpdateOrgForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	orgId, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}
	return hs.updateOrgHelper(c.Req.Context(), form, orgId)
}

func (hs *HTTPServer) updateOrgHelper(ctx context.Context, form dtos.UpdateOrgForm, orgID int64) response.Response {
	cmd := org.UpdateOrgCommand{Name: form.Name, OrgId: orgID}
	if err := hs.orgService.UpdateOrg(ctx, &cmd); err != nil {
		if errors.Is(err, models.ErrOrgNameTaken) {
			return response.Error(http.StatusBadRequest, "Organization name taken", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to update organization", err)
	}

	return response.Success("Organization updated")
}

// swagger:route PUT /org/address org updateCurrentOrgAddress
//
// Update current Organization's address.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) UpdateCurrentOrgAddress(c *models.ReqContext) response.Response {
	form := dtos.UpdateOrgAddressForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	return hs.updateOrgAddressHelper(c.Req.Context(), form, c.OrgID)
}

// swagger:route PUT /orgs/{org_id}/address orgs updateOrgAddress
//
// Update Organization's address.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) UpdateOrgAddress(c *models.ReqContext) response.Response {
	form := dtos.UpdateOrgAddressForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	orgId, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}
	return hs.updateOrgAddressHelper(c.Req.Context(), form, orgId)
}

func (hs *HTTPServer) updateOrgAddressHelper(ctx context.Context, form dtos.UpdateOrgAddressForm, orgID int64) response.Response {
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

	if err := hs.SQLStore.UpdateOrgAddress(ctx, &cmd); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update org address", err)
	}

	return response.Success("Address updated")
}

// swagger:route DELETE /orgs/{org_id} orgs deleteOrgByID
//
// Delete Organization.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) DeleteOrgByID(c *models.ReqContext) response.Response {
	orgID, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}
	// before deleting an org, check if user does not belong to the current org
	if c.OrgID == orgID {
		return response.Error(http.StatusBadRequest, "Can not delete org for current user", nil)
	}

	if err := hs.SQLStore.DeleteOrg(c.Req.Context(), &models.DeleteOrgCommand{Id: orgID}); err != nil {
		if errors.Is(err, models.ErrOrgNotFound) {
			return response.Error(http.StatusNotFound, "Failed to delete organization. ID not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to update organization", err)
	}
	return response.Success("Organization deleted")
}

// swagger:route GET /orgs orgs searchOrgs
//
// Search all Organizations.
//
// Security:
// - basic:
//
// Responses:
// 200: searchOrgsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 409: conflictError
// 500: internalServerError
func (hs *HTTPServer) SearchOrgs(c *models.ReqContext) response.Response {
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

	if err := hs.SQLStore.SearchOrgs(c.Req.Context(), &query); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to search orgs", err)
	}

	return response.JSON(http.StatusOK, query.Result)
}

// swagger:parameters updateCurrentOrgAddress
type UpdateCurrentOrgAddressParams struct {
	// in:body
	// required:true
	Body dtos.UpdateOrgAddressForm `json:"body"`
}

// swagger:parameters updateCurrentOrgUser
type UpdateCurrentOrgUserParams struct {
	// in:body
	// required:true
	Body models.UpdateOrgUserCommand `json:"body"`
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters updateCurrentOrg
type UpdateCurrentOrgParams struct {
	// in:body
	// required:true
	Body dtos.UpdateOrgForm `json:"body"`
}

// swagger:parameters updateOrgAddress
type UpdateOrgAddressParams struct {
	// in:body
	// required:true
	Body dtos.UpdateOrgAddressForm `json:"body"`
	// in:path
	// required:true
	OrgID int64 `json:"org_id"`
}

// swagger:parameters getOrgByID
type GetOrgByIDParams struct {
	// in:path
	// required:true
	OrgID int64 `json:"org_id"`
}

// swagger:parameters deleteOrgByID
type DeleteOrgByIDParams struct {
	// in:path
	// required:true
	OrgID int64 `json:"org_id"`
}

// swagger:parameters updateOrg
type UpdateOrgParams struct {
	// in:body
	// required:true
	Body dtos.UpdateOrgForm `json:"body"`
	// in:path
	// required:true
	OrgID int64 `json:"org_id"`
}

// swagger:parameters getOrgByName
type GetOrgByNameParams struct {
	// in:path
	// required:true
	OrgName string `json:"org_name"`
}

// swagger:parameters createOrg
type CreateOrgParams struct {
	// in:body
	// required:true
	Body models.CreateOrgCommand `json:"body"`
}

// swagger:parameters searchOrgs
type SearchOrgParams struct {
	// in:query
	// required:false
	// default: 1
	Page int `json:"page"`
	// Number of items per page
	// The totalCount field in the response can be used for pagination list E.g. if totalCount is equal to 100 teams and the perpage parameter is set to 10 then there are 10 pages of teams.
	// in:query
	// required:false
	// default: 1000
	PerPage int    `json:"perpage"`
	Name    string `json:"name"`
	// If set it will return results where the query value is contained in the name field. Query values with spaces need to be URL encoded.
	// required:false
	Query string `json:"query"`
}

// swagger:response createOrgResponse
type CreateOrgResponse struct {
	// The response message
	// in: body
	Body struct {
		// ID Identifier of the created org.
		// required: true
		// example: 65
		OrgID int64 `json:"orgId"`

		// Message Message of the created org.
		// required: true
		// example: Data source added
		Message string `json:"message"`
	} `json:"body"`
}

// swagger:response searchOrgsResponse
type SearchOrgsResponse struct {
	// The response message
	// in: body
	Body []*models.OrgDTO `json:"body"`
}

// swagger:response getCurrentOrgResponse
type GetCurrentOrgResponse struct {
	// The response message
	// in: body
	Body models.OrgDetailsDTO `json:"body"`
}

// swagger:response getOrgByIDResponse
type GetOrgByIDResponse struct {
	// The response message
	// in: body
	Body models.OrgDetailsDTO `json:"body"`
}

// swagger:response getOrgByNameResponse
type GetOrgByNameResponse struct {
	// The response message
	// in: body
	Body models.OrgDetailsDTO `json:"body"`
}

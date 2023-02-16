package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/metrics"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
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
func (hs *HTTPServer) GetCurrentOrg(c *contextmodel.ReqContext) response.Response {
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
func (hs *HTTPServer) GetOrgByID(c *contextmodel.ReqContext) response.Response {
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
func (hs *HTTPServer) GetOrgByName(c *contextmodel.ReqContext) response.Response {
	orga, err := hs.orgService.GetByName(c.Req.Context(), &org.GetOrgByNameQuery{Name: web.Params(c.Req)[":name"]})
	if err != nil {
		if errors.Is(err, org.ErrOrgNotFound) {
			return response.Error(http.StatusNotFound, "Organization not found", err)
		}

		return response.Error(http.StatusInternalServerError, "Failed to get organization", err)
	}
	result := org.OrgDetailsDTO{
		ID:   orga.ID,
		Name: orga.Name,
		Address: org.Address{
			Address1: orga.Address1,
			Address2: orga.Address2,
			City:     orga.City,
			ZipCode:  orga.ZipCode,
			State:    orga.State,
			Country:  orga.Country,
		},
	}

	return response.JSON(http.StatusOK, &result)
}

func (hs *HTTPServer) getOrgHelper(ctx context.Context, orgID int64) response.Response {
	query := org.GetOrgByIDQuery{ID: orgID}

	res, err := hs.orgService.GetByID(ctx, &query)
	if err != nil {
		if errors.Is(err, org.ErrOrgNotFound) {
			return response.Error(http.StatusNotFound, "Organization not found", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to get organization", err)
	}

	orga := res
	result := org.OrgDetailsDTO{
		ID:   orga.ID,
		Name: orga.Name,
		Address: org.Address{
			Address1: orga.Address1,
			Address2: orga.Address2,
			City:     orga.City,
			ZipCode:  orga.ZipCode,
			State:    orga.State,
			Country:  orga.Country,
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
func (hs *HTTPServer) CreateOrg(c *contextmodel.ReqContext) response.Response {
	cmd := org.CreateOrgCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	acEnabled := !hs.AccessControl.IsDisabled()
	if !acEnabled && !(setting.AllowUserOrgCreate || c.IsGrafanaAdmin) {
		return response.Error(http.StatusForbidden, "Access denied", nil)
	}

	cmd.UserID = c.UserID
	result, err := hs.orgService.CreateWithMember(c.Req.Context(), &cmd)
	if err != nil {
		if errors.Is(err, org.ErrOrgNameTaken) {
			return response.Error(http.StatusConflict, "Organization name taken", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to create organization", err)
	}

	metrics.MApiOrgCreate.Inc()

	return response.JSON(http.StatusOK, &util.DynMap{
		"orgId":   result.ID,
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
func (hs *HTTPServer) UpdateCurrentOrg(c *contextmodel.ReqContext) response.Response {
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
func (hs *HTTPServer) UpdateOrg(c *contextmodel.ReqContext) response.Response {
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
		if errors.Is(err, org.ErrOrgNameTaken) {
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
func (hs *HTTPServer) UpdateCurrentOrgAddress(c *contextmodel.ReqContext) response.Response {
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
func (hs *HTTPServer) UpdateOrgAddress(c *contextmodel.ReqContext) response.Response {
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
	cmd := org.UpdateOrgAddressCommand{
		OrgID: orgID,
		Address: org.Address{
			Address1: form.Address1,
			Address2: form.Address2,
			City:     form.City,
			State:    form.State,
			ZipCode:  form.ZipCode,
			Country:  form.Country,
		},
	}

	if err := hs.orgService.UpdateAddress(ctx, &cmd); err != nil {
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
func (hs *HTTPServer) DeleteOrgByID(c *contextmodel.ReqContext) response.Response {
	orgID, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}
	// before deleting an org, check if user does not belong to the current org
	if c.OrgID == orgID {
		return response.Error(http.StatusBadRequest, "Can not delete org for current user", nil)
	}

	if err := hs.orgService.Delete(c.Req.Context(), &org.DeleteOrgCommand{ID: orgID}); err != nil {
		if errors.Is(err, org.ErrOrgNotFound) {
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
func (hs *HTTPServer) SearchOrgs(c *contextmodel.ReqContext) response.Response {
	perPage := c.QueryInt("perpage")
	if perPage <= 0 {
		perPage = 1000
	}

	page := c.QueryInt("page")

	query := org.SearchOrgsQuery{
		Query: c.Query("query"),
		Name:  c.Query("name"),
		Page:  page,
		Limit: perPage,
	}

	result, err := hs.orgService.Search(c.Req.Context(), &query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to search orgs", err)
	}

	return response.JSON(http.StatusOK, result)
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
	Body org.UpdateOrgUserCommand `json:"body"`
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
	Body org.CreateOrgCommand `json:"body"`
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
	Body []*org.OrgDTO `json:"body"`
}

// swagger:response getCurrentOrgResponse
type GetCurrentOrgResponse struct {
	// The response message
	// in: body
	Body org.OrgDetailsDTO `json:"body"`
}

// swagger:response getOrgByIDResponse
type GetOrgByIDResponse struct {
	// The response message
	// in: body
	Body org.OrgDetailsDTO `json:"body"`
}

// swagger:response getOrgByNameResponse
type GetOrgByNameResponse struct {
	// The response message
	// in: body
	Body org.OrgDetailsDTO `json:"body"`
}

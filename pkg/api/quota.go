package api

import (
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetCurrentOrgQuotas(c *models.ReqContext) response.Response {
	return hs.getOrgQuotasHelper(c, c.OrgID)
}

// swagger:route GET /orgs/{org_id}/quotas orgs getOrgQuota
//
// Fetch Organization quota.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `orgs.quotas:read` and scope `org:id:1` (orgIDScope).
//
// Responses:
// 200: getQuotaResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetOrgQuotas(c *models.ReqContext) response.Response {
	orgId, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}
	return hs.getOrgQuotasHelper(c, orgId)
}

func (hs *HTTPServer) getOrgQuotasHelper(c *models.ReqContext, orgID int64) response.Response {
	if !hs.Cfg.Quota.Enabled {
		return response.Error(404, "Quotas not enabled", nil)
	}
	query := models.GetOrgQuotasQuery{OrgId: orgID}

	if err := hs.SQLStore.GetOrgQuotas(c.Req.Context(), &query); err != nil {
		return response.Error(500, "Failed to get org quotas", err)
	}

	return response.JSON(http.StatusOK, query.Result)
}

// swagger:route PUT /orgs/{org_id}/quotas/{quota_target} orgs updateOrgQuota
//
// Update user quota.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `orgs.quotas:write` and scope `org:id:1` (orgIDScope).
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) UpdateOrgQuota(c *models.ReqContext) response.Response {
	cmd := models.UpdateOrgQuotaCmd{}
	var err error
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if !hs.Cfg.Quota.Enabled {
		return response.Error(404, "Quotas not enabled", nil)
	}
	cmd.OrgId, err = strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}
	cmd.Target = web.Params(c.Req)[":target"]

	if _, ok := hs.Cfg.Quota.Org.ToMap()[cmd.Target]; !ok {
		return response.Error(404, "Invalid quota target", nil)
	}

	if err := hs.SQLStore.UpdateOrgQuota(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to update org quotas", err)
	}
	return response.Success("Organization quota updated")
}

// swagger:route GET /admin/users/{user_id}/quotas admin_users getUserQuota
//
// Fetch user quota.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users.quotas:list` and scope `global.users:1` (userIDScope).
//
// Security:
// - basic:
//
// Responses:
// 200: getQuotaResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /user/quotas signed_in_user getUserQuotas
//
// Fetch user quota.
//
// Responses:
// 200: getQuotaResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetUserQuotas(c *models.ReqContext) response.Response {
	if !setting.Quota.Enabled {
		return response.Error(404, "Quotas not enabled", nil)
	}

	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	query := models.GetUserQuotasQuery{UserId: id}

	if err := hs.SQLStore.GetUserQuotas(c.Req.Context(), &query); err != nil {
		return response.Error(500, "Failed to get org quotas", err)
	}

	return response.JSON(http.StatusOK, query.Result)
}

// swagger:route PUT /admin/users/{user_id}/quotas/{quota_target} admin_users updateUserQuota
//
// Update user quota.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users.quotas:update` and scope `global.users:1` (userIDScope).
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) UpdateUserQuota(c *models.ReqContext) response.Response {
	cmd := models.UpdateUserQuotaCmd{}
	var err error
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if !setting.Quota.Enabled {
		return response.Error(404, "Quotas not enabled", nil)
	}
	cmd.UserId, err = strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	cmd.Target = web.Params(c.Req)[":target"]

	if _, ok := setting.Quota.User.ToMap()[cmd.Target]; !ok {
		return response.Error(404, "Invalid quota target", nil)
	}

	if err := hs.SQLStore.UpdateUserQuota(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to update org quotas", err)
	}
	return response.Success("Organization quota updated")
}

// swagger:parameters updateUserQuota
type UpdateUserQuotaParams struct {
	// in:body
	// required:true
	Body models.UpdateUserQuotaCmd `json:"body"`
	// in:path
	// required:true
	QuotaTarget string `json:"quota_target"`
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters getUserQuota
type GetUserQuotaParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters getOrgQuota
type GetOrgQuotaParams struct {
	// in:path
	// required:true
	OrgID int64 `json:"org_id"`
}

// swagger:parameters updateOrgQuota
type UpdateOrgQuotaParam struct {
	// in:body
	// required:true
	Body models.UpdateOrgQuotaCmd `json:"body"`
	// in:path
	// required:true
	QuotaTarget string `json:"quota_target"`
	// in:path
	// required:true
	OrgID int64 `json:"org_id"`
}

// swagger:response getQuotaResponse
type GetQuotaResponseResponse struct {
	// in:body
	Body []*models.UserQuotaDTO `json:"body"`
}

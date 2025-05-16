package api

import (
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/web"
)

// swagger:route GET /org/quotas quota org getCurrentOrgQuota
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
func (hs *HTTPServer) GetCurrentOrgQuotas(c *contextmodel.ReqContext) response.Response {
	return hs.getOrgQuotasHelper(c, c.GetOrgID())
}

// swagger:route GET /orgs/{org_id}/quotas quota orgs getOrgQuota
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
func (hs *HTTPServer) GetOrgQuotas(c *contextmodel.ReqContext) response.Response {
	orgId, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Err(quota.ErrBadRequest.Errorf("orgId is invalid: %w", err))
	}
	return hs.getOrgQuotasHelper(c, orgId)
}

func (hs *HTTPServer) getOrgQuotasHelper(c *contextmodel.ReqContext, orgID int64) response.Response {
	ctx, span := hs.tracer.Start(c.Req.Context(), "api.getOrgQuotasHelper")
	defer span.End()
	q, err := hs.QuotaService.GetQuotasByScope(ctx, quota.OrgScope, orgID)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to get quota", err)
	}
	return response.JSON(http.StatusOK, q)
}

// swagger:route PUT /orgs/{org_id}/quotas/{quota_target} quota orgs updateOrgQuota
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
func (hs *HTTPServer) UpdateOrgQuota(c *contextmodel.ReqContext) response.Response {
	ctx, span := hs.tracer.Start(c.Req.Context(), "api.UpdateOrgQuota")
	defer span.End()
	cmd := quota.UpdateQuotaCmd{}
	var err error
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Err(quota.ErrBadRequest.Errorf("bad request data: %w", err))
	}
	cmd.OrgID, err = strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Err(quota.ErrBadRequest.Errorf("orgId is invalid: %w", err))
	}
	cmd.Target = web.Params(c.Req)[":target"]

	if err := hs.QuotaService.Update(ctx, &cmd); err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to update org quotas", err)
	}
	return response.Success("Organization quota updated")
}

// swagger:route GET /admin/users/{user_id}/quotas quota admin_users getUserQuota
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

// swagger:route GET /user/quotas quota signed_in_user getUserQuotas
//
// Fetch user quota.
//
// Responses:
// 200: getQuotaResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetUserQuotas(c *contextmodel.ReqContext) response.Response {
	ctx, span := hs.tracer.Start(c.Req.Context(), "api.GetUserQuotas")
	defer span.End()
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Err(quota.ErrBadRequest.Errorf("id is invalid: %w", err))
	}

	q, err := hs.QuotaService.GetQuotasByScope(ctx, quota.UserScope, id)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to get org quotas", err)
	}

	return response.JSON(http.StatusOK, q)
}

// swagger:route PUT /admin/users/{user_id}/quotas/{quota_target} quota admin_users updateUserQuota
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
func (hs *HTTPServer) UpdateUserQuota(c *contextmodel.ReqContext) response.Response {
	ctx, span := hs.tracer.Start(c.Req.Context(), "api.UpdateUserQuota")
	defer span.End()
	cmd := quota.UpdateQuotaCmd{}
	var err error
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Err(quota.ErrBadRequest.Errorf("bad request data: %w", err))
	}
	cmd.UserID, err = strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Err(quota.ErrBadRequest.Errorf("id is invalid: %w", err))
	}
	cmd.Target = web.Params(c.Req)[":target"]

	if err := hs.QuotaService.Update(ctx, &cmd); err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to update org quotas", err)
	}
	return response.Success("Organization quota updated")
}

// swagger:parameters updateUserQuota
type UpdateUserQuotaParams struct {
	// in:body
	// required:true
	Body quota.UpdateQuotaCmd `json:"body"`
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
	Body quota.UpdateQuotaCmd `json:"body"`
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
	Body []*quota.QuotaDTO `json:"body"`
}

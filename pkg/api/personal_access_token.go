package api

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patscope"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

// PersonalAccessTokenDTO never contains the token secret, only a display hint.
type PersonalAccessTokenDTO struct {
	UID        string              `json:"uid"`
	Name       string              `json:"name"`
	Hint       string              `json:"hint"`
	Scopes     map[string][]string `json:"scopes"`
	CreatedAt  time.Time           `json:"createdAt"`
	ExpiresAt  *time.Time          `json:"expiresAt"`
	LastUsedAt *time.Time          `json:"lastUsedAt"`
	RevokedAt  *time.Time          `json:"revokedAt"`
}

// AdminPersonalAccessTokenDTO adds owner, organization and audit details to a token.
type AdminPersonalAccessTokenDTO struct {
	PersonalAccessTokenDTO
	UserID        int64  `json:"userId"`
	OwnerLogin    string `json:"ownerLogin"`
	OwnerEmail    string `json:"ownerEmail"`
	OwnerName     string `json:"ownerName"`
	OrgID         int64  `json:"orgId"`
	OrgName       string `json:"orgName"`
	CreatedIP     string `json:"createdIp"`
	LastUsedIP    string `json:"lastUsedIp"`
	LastUsedUA    string `json:"lastUsedUserAgent"`
	RevokedReason string `json:"revokedReason"`
}

// SearchPersonalAccessTokensResponse is a page of tokens.
type SearchPersonalAccessTokensResponse struct {
	Tokens  []AdminPersonalAccessTokenDTO `json:"tokens"`
	Total   int64                         `json:"totalCount"`
	Page    int                           `json:"page"`
	PerPage int                           `json:"perPage"`
}

// CreatePersonalAccessTokenCommand is the body of a create request.
type CreatePersonalAccessTokenCommand struct {
	Name string `json:"name"`
	// Scopes maps RBAC action patterns to optional resource scopes.
	Scopes map[string][]string `json:"scopes"`
	// LifetimeDays defaults to the instance default when 0; -1 requests no expiry where allowed.
	LifetimeDays int `json:"lifetimeDays"`
}

// CreatePersonalAccessTokenResponse is the only place the secret is ever returned.
type CreatePersonalAccessTokenResponse struct {
	PersonalAccessTokenDTO
	Token string `json:"token"`
}

func toPATDTO(t *patstore.Token) PersonalAccessTokenDTO {
	return PersonalAccessTokenDTO{
		UID: t.UID, Name: t.Name, Hint: t.PrefixHint, Scopes: patscope.ParseStored(t.Scopes),
		CreatedAt: t.CreatedAt, ExpiresAt: t.ExpiresAt, LastUsedAt: t.LastUsedAt, RevokedAt: t.RevokedAt,
	}
}

func (hs *HTTPServer) patActor(c *contextmodel.ReqContext) personalaccesstokens.Actor {
	return personalaccesstokens.Actor{UserID: c.SignedInUser.UserID, OrgID: c.GetOrgID(), IP: hs.patClientIP(c)}
}

// patClientIP resolves the audit IP from the TCP peer, honoring forwarding headers only from trusted proxies.
func (hs *HTTPServer) patClientIP(c *contextmodel.ReqContext) string {
	if hs.Cfg == nil {
		return patscope.ClientIP(c.Req, patscope.TrustedProxies{})
	}
	cfg := hs.Cfg.PersonalAccessTokens
	return patscope.ClientIP(c.Req, patscope.ParseTrustedProxies(cfg.TrustedProxyHeader, cfg.TrustedProxies))
}

func patError(err error) response.Response {
	var e errutil.Error
	if errors.As(err, &e) {
		return response.Err(err)
	}
	return response.Error(http.StatusInternalServerError, "Internal server error", err)
}

// swagger:route GET /user/tokens signed_in_user listPersonalAccessTokens
//
// List the personal access tokens of the actual user.
//
// Responses:
// 200: listPersonalAccessTokensResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) ListUserPersonalAccessTokens(c *contextmodel.ReqContext) response.Response {
	if !c.IsIdentityType(claims.TypeUser) {
		return response.Error(http.StatusForbidden, "entity not allowed to list tokens", nil)
	}
	return hs.listPATs(c, c.SignedInUser.UserID)
}

// swagger:route GET /users/{user_id}/tokens users listUserPersonalAccessTokens
//
// List the personal access tokens of a user in the current organization.
//
// Responses:
// 200: listPersonalAccessTokensResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) AdminListUserPersonalAccessTokens(c *contextmodel.ReqContext) response.Response {
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	return hs.listPATs(c, userID)
}

func (hs *HTTPServer) listPATs(c *contextmodel.ReqContext, userID int64) response.Response {
	tokens, err := hs.personalTokenService.List(c.Req.Context(), userID, c.GetOrgID())
	if err != nil {
		return patError(err)
	}
	out := make([]PersonalAccessTokenDTO, 0, len(tokens))
	for _, t := range tokens {
		out = append(out, toPATDTO(t))
	}
	return response.JSON(http.StatusOK, out)
}

// swagger:route POST /user/tokens signed_in_user createPersonalAccessToken
//
// Create a personal access token for the actual user.
//
// The token secret is returned only in this response and cannot be retrieved later.
//
// Responses:
// 200: createPersonalAccessTokenResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) CreateUserPersonalAccessToken(c *contextmodel.ReqContext) response.Response {
	if !c.IsIdentityType(claims.TypeUser) || c.SignedInUser.GetAuthenticatedBy() == login.PersonalTokenAuthModule {
		return response.Error(http.StatusForbidden, "entity not allowed to create tokens", nil)
	}
	cmd := CreatePersonalAccessTokenCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	res, err := hs.personalTokenService.Create(c.Req.Context(), hs.patActor(c), personalaccesstokens.CreateRequest{
		Name: cmd.Name, Scopes: cmd.Scopes, LifetimeDays: cmd.LifetimeDays,
		OwnerPermissions: c.SignedInUser.GetPermissions(),
	})
	if err != nil {
		return patError(err)
	}
	hs.notifyPATOwner(c.Req.Context(), c.SignedInUser.UserID, res.Token.Name, "created")
	return response.JSON(http.StatusOK, CreatePersonalAccessTokenResponse{PersonalAccessTokenDTO: toPATDTO(res.Token), Token: res.Secret})
}

// swagger:route DELETE /user/tokens/{token_uid} signed_in_user revokePersonalAccessToken
//
// Revoke a personal access token of the actual user.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) RevokeUserPersonalAccessToken(c *contextmodel.ReqContext) response.Response {
	if !c.IsIdentityType(claims.TypeUser) {
		return response.Error(http.StatusForbidden, "entity not allowed to revoke tokens", nil)
	}
	return hs.revokePAT(c, c.SignedInUser.UserID, patstore.ReasonUser)
}

// swagger:route DELETE /users/{user_id}/tokens/{token_uid} users adminRevokePersonalAccessToken
//
// Revoke a personal access token of a user in the current organization.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) AdminRevokeUserPersonalAccessToken(c *contextmodel.ReqContext) response.Response {
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	return hs.revokePAT(c, userID, patstore.ReasonAdmin)
}

func (hs *HTTPServer) revokePAT(c *contextmodel.ReqContext, userID int64, reason string) response.Response {
	uid := web.Params(c.Req)[":uid"]
	tokenName := hs.patTokenName(c, userID, uid)
	if err := hs.personalTokenService.Revoke(c.Req.Context(), hs.patActor(c), userID, uid, reason); err != nil {
		return patError(err)
	}
	hs.notifyPATOwner(c.Req.Context(), userID, tokenName, "revoked")
	return response.JSON(http.StatusOK, map[string]string{"message": "Personal access token revoked"})
}

func (hs *HTTPServer) patTokenName(c *contextmodel.ReqContext, userID int64, uid string) string {
	tokens, err := hs.personalTokenService.List(c.Req.Context(), userID, c.SignedInUser.GetOrgID())
	if err != nil {
		return ""
	}
	for _, t := range tokens {
		if t.UID == uid {
			return t.Name
		}
	}
	return ""
}

// notifyPATOwner emails the token owner about a lifecycle event. It is best effort and never includes the secret.
func (hs *HTTPServer) notifyPATOwner(ctx context.Context, userID int64, tokenName, event string) {
	if hs.NotificationService == nil || tokenName == "" {
		return
	}
	logger := log.New("personalaccesstokens.notify")
	owner, err := hs.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: userID})
	if err != nil || owner == nil || owner.Email == "" {
		return
	}
	err = hs.NotificationService.SendEmailCommandHandler(ctx, &notifications.SendEmailCommand{
		To:       []string{owner.Email},
		Template: "personal_access_token_event",
		Data: map[string]any{
			"Name":      owner.NameOrFallback(),
			"TokenName": tokenName,
			"Event":     event,
		},
	})
	if err != nil && !errors.Is(err, notifications.ErrSmtpNotEnabled) {
		logger.Warn("Failed to send personal access token notification", "userId", userID, "event", event, "error", err)
	}
}

// swagger:response listPersonalAccessTokensResponse
type listPersonalAccessTokensResponse struct {
	// in:body
	Body []PersonalAccessTokenDTO `json:"body"`
}

// swagger:response createPersonalAccessTokenResponse
type createPersonalAccessTokenResponse struct {
	// in:body
	Body CreatePersonalAccessTokenResponse `json:"body"`
}

// swagger:parameters createPersonalAccessToken
type createPersonalAccessTokenParams struct {
	// in:body
	// required:true
	Body CreatePersonalAccessTokenCommand `json:"body"`
}

// swagger:parameters revokePersonalAccessToken
type revokePersonalAccessTokenParams struct {
	// in:path
	// required:true
	TokenUID string `json:"token_uid"`
}

// swagger:parameters listUserPersonalAccessTokens
type listUserPersonalAccessTokensParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters adminRevokePersonalAccessToken
type adminRevokePersonalAccessTokenParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
	// in:path
	// required:true
	TokenUID string `json:"token_uid"`
}

// swagger:route GET /personal-access-tokens signed_in_user searchPersonalAccessTokens
//
// Search personal access tokens of all users.
//
// Limited to the current organization; Grafana server admins can pass scope=all to search every organization.
//
// Responses:
// 200: searchPersonalAccessTokensResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) SearchPersonalAccessTokens(c *contextmodel.ReqContext) response.Response {
	q := patstore.SearchQuery{
		OrgID:  c.GetOrgID(),
		Query:  strings.TrimSpace(c.Query("query")),
		Status: c.Query("status"),
		Page:   int(c.QueryInt64("page")),
		Limit:  int(c.QueryInt64("perpage")),
	}
	if c.Query("scope") == "all" {
		if !c.SignedInUser.GetIsGrafanaAdmin() {
			return response.Error(http.StatusForbidden, "instance-wide search requires a server admin", nil)
		}
		q.OrgID = 0
	}
	switch q.Status {
	case "", patstore.StatusActive, patstore.StatusExpired, patstore.StatusRevoked:
	default:
		return response.Error(http.StatusBadRequest, "invalid status", nil)
	}
	if v := c.Query("userId"); v != "" {
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return response.Error(http.StatusBadRequest, "userId is invalid", err)
		}
		q.UserID = id
	}
	if v := c.Query("expiringBefore"); v != "" {
		ts, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return response.Error(http.StatusBadRequest, "expiringBefore is invalid", err)
		}
		q.ExpiringBefore = &ts
	}
	if v := c.Query("sort"); v != "" {
		if !slices.Contains(patstore.SortFields, v) {
			return response.Error(http.StatusBadRequest, "invalid sort field", nil)
		}
		q.SortBy = v
	}
	switch c.Query("order") {
	case "", "asc":
	case "desc":
		q.SortDesc = true
	default:
		return response.Error(http.StatusBadRequest, "invalid order", nil)
	}
	if q.Page <= 0 {
		q.Page = 1
	}
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 50
	}
	res, err := hs.personalTokenService.Search(c.Req.Context(), q)
	if err != nil {
		return patError(err)
	}
	out := SearchPersonalAccessTokensResponse{Tokens: make([]AdminPersonalAccessTokenDTO, 0, len(res.Tokens)), Total: res.Total, Page: q.Page, PerPage: q.Limit}
	for _, t := range res.Tokens {
		out.Tokens = append(out.Tokens, AdminPersonalAccessTokenDTO{
			PersonalAccessTokenDTO: toPATDTO(&t.Token), UserID: t.UserID, OwnerLogin: t.OwnerLogin, OwnerEmail: t.OwnerEmail,
			OwnerName: t.OwnerName, OrgID: t.OrgID, OrgName: t.OrgName, CreatedIP: t.CreatedIP, LastUsedIP: t.LastUsedIP,
			LastUsedUA: t.LastUsedUA, RevokedReason: t.RevokedReason,
		})
	}
	return response.JSON(http.StatusOK, out)
}

// swagger:route DELETE /personal-access-tokens/{token_uid} signed_in_user revokePersonalAccessTokenByUID
//
// Revoke any personal access token in the current organization (any organization with scope=all for server admins).
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) RevokePersonalAccessTokenByUID(c *contextmodel.ReqContext) response.Response {
	orgID := c.GetOrgID()
	if c.Query("scope") == "all" {
		if !c.SignedInUser.GetIsGrafanaAdmin() {
			return response.Error(http.StatusForbidden, "instance-wide revoke requires a server admin", nil)
		}
		orgID = 0
	}
	if err := hs.personalTokenService.AdminRevoke(c.Req.Context(), hs.patActor(c), orgID, web.Params(c.Req)[":uid"]); err != nil {
		return patError(err)
	}
	return response.JSON(http.StatusOK, map[string]string{"message": "Personal access token revoked"})
}

// swagger:response searchPersonalAccessTokensResponse
type searchPersonalAccessTokensResponseWrapper struct {
	// in:body
	Body SearchPersonalAccessTokensResponse `json:"body"`
}

// swagger:parameters searchPersonalAccessTokens
type searchPersonalAccessTokensParams struct {
	// in:query
	Query string `json:"query"`
	// in:query
	Status string `json:"status"`
	// in:query
	UserID int64 `json:"userId"`
	// in:query
	ExpiringBefore string `json:"expiringBefore"`
	// in:query
	Scope string `json:"scope"`
	// Sort field: name, owner, org, created, expires, lastUsed, status or scopes.
	// in:query
	Sort string `json:"sort"`
	// in:query
	// enum: asc,desc
	Order string `json:"order"`
	// in:query
	Page int `json:"page"`
	// in:query
	PerPage int `json:"perpage"`
}

// swagger:parameters revokePersonalAccessTokenByUID
type revokePersonalAccessTokenByUIDParams struct {
	// in:path
	// required:true
	TokenUID string `json:"token_uid"`
	// in:query
	Scope string `json:"scope"`
}

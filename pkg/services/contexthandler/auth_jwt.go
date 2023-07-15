package contexthandler

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/jmespath/go-jmespath"

	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/models/roletype"
	authJWT "github.com/grafana/grafana/pkg/services/auth/jwt"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	loginsvc "github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	InvalidJWT         = "Invalid JWT"
	InvalidRole        = "Invalid Role"
	UserNotFound       = "User not found"
	authQueryParamName = "auth_token"
)

func (h *ContextHandler) initContextWithJWT(ctx *contextmodel.ReqContext, orgId int64) bool {
	if !h.Cfg.JWTAuthEnabled || h.Cfg.JWTAuthHeaderName == "" {
		return false
	}

	jwtToken := ctx.Req.Header.Get(h.Cfg.JWTAuthHeaderName)
	if jwtToken == "" && h.Cfg.JWTAuthURLLogin {
		jwtToken = ctx.Req.URL.Query().Get(authQueryParamName)
	}

	if jwtToken == "" {
		return false
	}

	stripSensitiveParam(h.Cfg, ctx.Req)

	// Strip the 'Bearer' prefix if it exists.
	jwtToken = strings.TrimPrefix(jwtToken, "Bearer ")

	// If the "sub" claim is missing or empty then pass the control to the next handler
	if !authJWT.HasSubClaim(jwtToken) {
		return false
	}

	claims, err := h.JWTAuthService.Verify(ctx.Req.Context(), jwtToken)
	if err != nil {
		ctx.Logger.Debug("Failed to verify JWT", "error", err)
		ctx.JsonApiErr(http.StatusUnauthorized, InvalidJWT, err)
		return true
	}

	query := user.GetSignedInUserQuery{OrgID: orgId}

	sub, _ := claims["sub"].(string)

	if sub == "" {
		ctx.Logger.Warn("Got a JWT without the mandatory 'sub' claim", "error", err)
		ctx.JsonApiErr(http.StatusUnauthorized, InvalidJWT, err)
		return true
	}
	extUser := &loginsvc.ExternalUserInfo{
		AuthModule: "jwt",
		AuthId:     sub,
		OrgRoles:   map[int64]org.RoleType{},
		// we do not want to sync team memberships from JWT authentication see - https://github.com/grafana/grafana/issues/62175
		SkipTeamSync: true,
	}

	if key := h.Cfg.JWTAuthUsernameClaim; key != "" {
		query.Login, _ = claims[key].(string)
		extUser.Login, _ = claims[key].(string)
	}
	if key := h.Cfg.JWTAuthEmailClaim; key != "" {
		query.Email, _ = claims[key].(string)
		extUser.Email, _ = claims[key].(string)
	}

	if name, _ := claims["name"].(string); name != "" {
		extUser.Name = name
	}

	var role roletype.RoleType
	var grafanaAdmin bool
	if !h.Cfg.JWTAuthSkipOrgRoleSync {
		role, grafanaAdmin = h.extractJWTRoleAndAdmin(claims)
		if h.Cfg.JWTAuthRoleAttributeStrict && !role.IsValid() {
			ctx.Logger.Debug("Extracted Role is invalid")
			ctx.JsonApiErr(http.StatusForbidden, InvalidRole, nil)
			return true
		}
		if role.IsValid() {
			var orgID int64
			if h.Cfg.AutoAssignOrg && h.Cfg.AutoAssignOrgId > 0 {
				orgID = int64(h.Cfg.AutoAssignOrgId)
				ctx.Logger.Debug("The user has a role assignment and organization membership is auto-assigned",
					"role", role, "orgId", orgID)
			} else {
				orgID = int64(1)
				ctx.Logger.Debug("The user has a role assignment and organization membership is not auto-assigned",
					"role", role, "orgId", orgID)
			}

			extUser.OrgRoles[orgID] = role
			if h.Cfg.JWTAuthAllowAssignGrafanaAdmin {
				extUser.IsGrafanaAdmin = &grafanaAdmin
			}
		}
	}

	if query.Login == "" && query.Email == "" {
		ctx.Logger.Debug("Failed to get an authentication claim from JWT")
		ctx.JsonApiErr(http.StatusUnauthorized, InvalidJWT, err)
		return true
	}

	if h.Cfg.JWTAuthAutoSignUp {
		upsert := &loginsvc.UpsertUserCommand{
			ReqContext:    ctx,
			SignupAllowed: h.Cfg.JWTAuthAutoSignUp,
			ExternalUser:  extUser,
			UserLookupParams: loginsvc.UserLookupParams{
				UserID: nil,
				Login:  &query.Login,
				Email:  &query.Email,
			},
		}
		if _, err := h.loginService.UpsertUser(ctx.Req.Context(), upsert); err != nil {
			ctx.Logger.Error("Failed to upsert JWT user", "error", err)
			return false
		}
	}

	queryResult, err := h.userService.GetSignedInUserWithCacheCtx(ctx.Req.Context(), &query)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			ctx.Logger.Debug(
				"Failed to find user using JWT claims",
				"email_claim", query.Email,
				"username_claim", query.Login,
			)
			err = login.ErrInvalidCredentials
			ctx.JsonApiErr(http.StatusUnauthorized, UserNotFound, err)
		} else {
			ctx.Logger.Error("Failed to get signed in user", "error", err)
			ctx.JsonApiErr(http.StatusUnauthorized, InvalidJWT, err)
		}
		return true
	}

	ctx.SignedInUser = queryResult
	ctx.IsSignedIn = true

	return true
}

const roleGrafanaAdmin = "GrafanaAdmin"

func (h *ContextHandler) extractJWTRoleAndAdmin(claims map[string]interface{}) (org.RoleType, bool) {
	if h.Cfg.JWTAuthRoleAttributePath == "" {
		return "", false
	}

	role, err := searchClaimsForStringAttr(h.Cfg.JWTAuthRoleAttributePath, claims)
	if err != nil || role == "" {
		return "", false
	}

	if role == roleGrafanaAdmin {
		return org.RoleAdmin, true
	}
	return org.RoleType(role), false
}

func searchClaimsForAttr(attributePath string, claims map[string]interface{}) (interface{}, error) {
	if attributePath == "" {
		return "", errors.New("no attribute path specified")
	}

	if len(claims) == 0 {
		return "", errors.New("empty claims provided")
	}

	val, err := jmespath.Search(attributePath, claims)
	if err != nil {
		return "", fmt.Errorf("failed to search claims with provided path: %q: %w", attributePath, err)
	}

	return val, nil
}

func searchClaimsForStringAttr(attributePath string, claims map[string]interface{}) (string, error) {
	val, err := searchClaimsForAttr(attributePath, claims)
	if err != nil {
		return "", err
	}

	strVal, ok := val.(string)
	if ok {
		return strVal, nil
	}

	return "", nil
}

// remove sensitive query params
// avoid JWT URL login passing auth_token in URL
func stripSensitiveParam(cfg *setting.Cfg, httpRequest *http.Request) {
	if cfg.JWTAuthURLLogin {
		params := httpRequest.URL.Query()
		if params.Has(authQueryParamName) {
			params.Del(authQueryParamName)
			httpRequest.URL.RawQuery = params.Encode()
		}
	}
}

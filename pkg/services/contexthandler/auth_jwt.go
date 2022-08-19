package contexthandler

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
)

const InvalidJWT = "Invalid JWT"
const UserNotFound = "User not found"

func (h *ContextHandler) initContextWithJWT(ctx *models.ReqContext, orgId int64) bool {
	if !h.Cfg.JWTAuthEnabled || h.Cfg.JWTAuthHeaderName == "" {
		return false
	}

	jwtToken := ctx.Req.Header.Get(h.Cfg.JWTAuthHeaderName)
	if jwtToken == "" && h.Cfg.JWTAuthURLLogin {
		jwtToken = ctx.Req.URL.Query().Get("auth_token")
	}

	if jwtToken == "" {
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
	extUser := &models.ExternalUserInfo{
		AuthModule: "jwt",
		AuthId:     sub,
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

	if query.Login == "" && query.Email == "" {
		ctx.Logger.Debug("Failed to get an authentication claim from JWT")
		ctx.JsonApiErr(http.StatusUnauthorized, InvalidJWT, err)
		return true
	}

	if h.Cfg.JWTAuthAutoSignUp {
		upsert := &models.UpsertUserCommand{
			ReqContext:    ctx,
			SignupAllowed: h.Cfg.JWTAuthAutoSignUp,
			ExternalUser:  extUser,
			UserLookupParams: models.UserLookupParams{
				UserID: nil,
				Login:  &query.Login,
				Email:  &query.Email,
			},
		}
		if err := h.loginService.UpsertUser(ctx.Req.Context(), upsert); err != nil {
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

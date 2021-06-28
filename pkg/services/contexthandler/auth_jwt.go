package contexthandler

import (
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/models"
)

const InvalidJWT = "Invalid JWT"

func (h *ContextHandler) initContextWithJWT(ctx *models.ReqContext, orgId int64) bool {
	if !h.Cfg.JWTAuthEnabled || h.Cfg.JWTAuthHeaderName == "" {
		return false
	}

	jwtToken := ctx.Req.Header.Get(h.Cfg.JWTAuthHeaderName)
	if jwtToken == "" {
		return false
	}

	claims, err := h.JWTAuthService.Verify(ctx.Req.Context(), jwtToken)
	if err != nil {
		ctx.Logger.Debug("Failed to verify JWT", "error", err)
		ctx.JsonApiErr(401, InvalidJWT, err)
		return true
	}

	query := models.GetSignedInUserQuery{OrgId: orgId}

	if key := h.Cfg.JWTAuthUsernameClaim; key != "" {
		query.Login, _ = claims[key].(string)
	}
	if key := h.Cfg.JWTAuthEmailClaim; key != "" {
		query.Email, _ = claims[key].(string)
	}

	if query.Login == "" && query.Email == "" {
		ctx.Logger.Debug("Failed to get an authentication claim from JWT")
		ctx.JsonApiErr(401, InvalidJWT, err)
		return true
	}

	if err := bus.DispatchCtx(ctx.Req.Context(), &query); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			ctx.Logger.Debug(
				"Failed to find user using JWT claims",
				"email_claim", query.Email,
				"username_claim", query.Login,
			)
			err = login.ErrInvalidCredentials
		} else {
			ctx.Logger.Error("Failed to get signed in user", "error", err)
		}
		ctx.JsonApiErr(401, InvalidJWT, err)
		return true
	}

	ctx.SignedInUser = query.Result
	ctx.IsSignedIn = true

	return true
}

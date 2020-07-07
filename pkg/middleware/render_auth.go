package middleware

import (
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rendering"
)

func initContextWithRenderAuth(ctx *models.ReqContext, renderService rendering.Service) bool {
	key := ctx.GetCookie("renderKey")
	if key == "" {
		return false
	}

	renderUser, exists := renderService.GetRenderUser(key)
	if !exists {
		ctx.JsonApiErr(401, "Invalid Render Key", nil)
		return true
	}

	ctx.IsSignedIn = true
	ctx.SignedInUser = &models.SignedInUser{
		OrgId:   renderUser.OrgID,
		UserId:  renderUser.UserID,
		OrgRole: models.RoleType(renderUser.OrgRole),
	}
	ctx.IsRenderCall = true
	ctx.LastSeenAt = time.Now()
	return true
}

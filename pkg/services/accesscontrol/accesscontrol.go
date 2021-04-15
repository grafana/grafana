package accesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

type AccessControl interface {
	// Evaluate evaluates access to the given resource.
	Evaluate(ctx context.Context, user *models.SignedInUser, permission string, scope ...string) (bool, error)

	// GetUserPermissions returns user permissions.
	GetUserPermissions(ctx context.Context, user *models.SignedInUser) ([]*Permission, error)

	// Middleware checks if service disabled or not to switch to fallback authorization.
	IsDisabled() bool
}

func HasAccess(ac AccessControl, c *models.ReqContext) func(fallback func(*models.ReqContext) bool, permission string, scopes ...string) bool {
	return func(fallback func(*models.ReqContext) bool, permission string, scopes ...string) bool {
		if ac.IsDisabled() {
			return fallback(c)
		}

		hasAccess, err := ac.Evaluate(c.Req.Context(), c.SignedInUser, permission, scopes...)
		if err != nil {
			c.Logger.Error("Error from access control system", "error", err)
			return false
		}

		return hasAccess
	}
}

var ReqGrafanaAdmin = func(c *models.ReqContext) bool {
	return c.IsGrafanaAdmin
}

var ReqOrgAdmin = func(c *models.ReqContext) bool {
	return c.OrgRole == models.ROLE_ADMIN
}

var ReqOrgAdminOrEditor = func(c *models.ReqContext) bool {
	return c.OrgRole == models.ROLE_ADMIN || c.OrgRole == models.ROLE_EDITOR
}

var ReqOrgAdminOrEditorsCanAdmin = func(cfg *setting.Cfg) func(*models.ReqContext) bool {
	return func(c *models.ReqContext) bool {
		return c.OrgRole == models.ROLE_ADMIN || (cfg.EditorsCanAdmin && c.OrgRole == models.ROLE_EDITOR)
	}
}

var ReqSignedIn = func(c *models.ReqContext) bool {
	return c.IsSignedIn
}

package accesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type AccessControl interface {
	// Evaluate evaluates access to the given resources.
	Evaluate(ctx context.Context, user *models.SignedInUser, evaluator Evaluator) (bool, error)

	// GetUserPermissions returns user permissions.
	GetUserPermissions(ctx context.Context, user *models.SignedInUser) ([]*Permission, error)

	//IsDisabled returns if access control is enabled or not
	IsDisabled() bool

	// DeclareFixedRoles allow the caller to declare, to the service, fixed roles and their
	// assignments to organization roles ("Viewer", "Editor", "Admin") or "Grafana Admin"
	DeclareFixedRoles(...RoleRegistration) error
}

func HasAccess(ac AccessControl, c *models.ReqContext) func(fallback func(*models.ReqContext) bool, evaluator Evaluator) bool {
	return func(fallback func(*models.ReqContext) bool, evaluator Evaluator) bool {
		if ac.IsDisabled() {
			return fallback(c)
		}

		hasAccess, err := ac.Evaluate(c.Req.Context(), c.SignedInUser, evaluator)
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

func BuildPermissionsMap(permissions []*Permission) map[string]bool {
	permissionsMap := make(map[string]bool)
	for _, p := range permissions {
		permissionsMap[p.Action] = true
	}

	return permissionsMap
}

// GroupScopesByAction will group scopes on action
func GroupScopesByAction(permissions []*Permission) map[string]map[string]struct{} {
	m := make(map[string]map[string]struct{})
	for _, p := range permissions {
		if _, ok := m[p.Action]; ok {
			m[p.Action][p.Scope] = struct{}{}
		} else {
			m[p.Action] = map[string]struct{}{p.Scope: {}}
		}
	}
	return m
}

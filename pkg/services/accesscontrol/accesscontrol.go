package accesscontrol

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/models"
)

type AccessControl interface {
	// Evaluate evaluates access to the given resources.
	Evaluate(ctx context.Context, user *models.SignedInUser, evaluator Evaluator) (bool, error)

	// GetUserPermissions returns user permissions.
	GetUserPermissions(ctx context.Context, user *models.SignedInUser) ([]*Permission, error)

	// GetUserRoles returns user roles.
	GetUserRoles(ctx context.Context, user *models.SignedInUser) ([]*RoleDTO, error)

	//IsDisabled returns if access control is enabled or not
	IsDisabled() bool

	// DeclareFixedRoles allow the caller to declare, to the service, fixed roles and their
	// assignments to organization roles ("Viewer", "Editor", "Admin") or "Grafana Admin"
	DeclareFixedRoles(...RoleRegistration) error
}

type PermissionsProvider interface {
	GetUserPermissions(ctx context.Context, query GetUserPermissionsQuery) ([]*Permission, error)
}

type ResourceStore interface {
	// SetUserResourcePermissions sets permissions for managed user role on a resource
	SetUserResourcePermissions(ctx context.Context, orgID, userID int64, cmd SetResourcePermissionsCommand) ([]ResourcePermission, error)
	// SetTeamResourcePermissions sets permissions for managed team role on a resource
	SetTeamResourcePermissions(ctx context.Context, orgID, teamID int64, cmd SetResourcePermissionsCommand) ([]ResourcePermission, error)
	// SetBuiltinResourcePermissions sets permissions for managed builtin role on a resource
	SetBuiltinResourcePermissions(ctx context.Context, orgID int64, builtinRole string, cmd SetResourcePermissionsCommand) ([]ResourcePermission, error)
	// RemoveResourcePermission remove permission for resource
	RemoveResourcePermission(ctx context.Context, orgID int64, cmd RemoveResourcePermissionCommand) error
	// GetResourcesPermissions will return all permission for all supplied resource ids
	GetResourcesPermissions(ctx context.Context, orgID int64, query GetResourcesPermissionsQuery) ([]ResourcePermission, error)
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

func ValidateScope(scope string) bool {
	prefix, last := scope[:len(scope)-1], scope[len(scope)-1]
	// verify that last char is either ':' or '/' if last character of scope is '*'
	if len(prefix) > 0 && last == '*' {
		lastChar := prefix[len(prefix)-1]
		if lastChar != ':' && lastChar != '/' {
			return false
		}
	}
	return !strings.ContainsAny(prefix, "*?")
}

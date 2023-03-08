package accesscontrol

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/registry"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type AccessControl interface {
	// Evaluate evaluates access to the given resources.
	Evaluate(ctx context.Context, user *user.SignedInUser, evaluator Evaluator) (bool, error)
	// RegisterScopeAttributeResolver allows the caller to register a scope resolver for a
	// specific scope prefix (ex: datasources:name:)
	RegisterScopeAttributeResolver(prefix string, resolver ScopeAttributeResolver)
	//IsDisabled returns if access control is enabled or not
	IsDisabled() bool
}

type Service interface {
	registry.ProvidesUsageStats
	// GetUserPermissions returns user permissions with only action and scope fields set.
	GetUserPermissions(ctx context.Context, user *user.SignedInUser, options Options) ([]Permission, error)
	// SearchUsersPermissions returns all users' permissions filtered by an action prefix
	SearchUsersPermissions(ctx context.Context, user *user.SignedInUser, orgID int64, options SearchOptions) (map[int64][]Permission, error)
	// ClearUserPermissionCache removes the permission cache entry for the given user
	ClearUserPermissionCache(user *user.SignedInUser)
	// SearchUserPermissions returns single user's permissions filtered by an action prefix or an action
	SearchUserPermissions(ctx context.Context, orgID int64, filterOptions SearchOptions) ([]Permission, error)
	// DeleteUserPermissions removes all permissions user has in org and all permission to that user
	// If orgID is set to 0 remove permissions from all orgs
	DeleteUserPermissions(ctx context.Context, orgID, userID int64) error
	// DeclareFixedRoles allows the caller to declare, to the service, fixed roles and their
	// assignments to organization roles ("Viewer", "Editor", "Admin") or "Grafana Admin"
	DeclareFixedRoles(registrations ...RoleRegistration) error
	//IsDisabled returns if access control is enabled or not
	IsDisabled() bool
}

type RoleRegistry interface {
	// RegisterFixedRoles registers all roles declared to AccessControl
	RegisterFixedRoles(ctx context.Context) error
}

type Options struct {
	ReloadCache bool
}

type SearchOptions struct {
	ActionPrefix string // Needed for the PoC v1, it's probably going to be removed.
	Action       string
	Scope        string
	UserID       int64 // ID for the user for which to return information, if none is specified information is returned for all users.
}

type TeamPermissionsService interface {
	GetPermissions(ctx context.Context, user *user.SignedInUser, resourceID string) ([]ResourcePermission, error)
	SetUserPermission(ctx context.Context, orgID int64, user User, resourceID, permission string) (*ResourcePermission, error)
}

type FolderPermissionsService interface {
	PermissionsService
}

type DashboardPermissionsService interface {
	PermissionsService
}

type DatasourcePermissionsService interface {
	PermissionsService
}

type ServiceAccountPermissionsService interface {
	PermissionsService
}

type PermissionsService interface {
	// GetPermissions returns all permissions for given resourceID
	GetPermissions(ctx context.Context, user *user.SignedInUser, resourceID string) ([]ResourcePermission, error)
	// SetUserPermission sets permission on resource for a user
	SetUserPermission(ctx context.Context, orgID int64, user User, resourceID, permission string) (*ResourcePermission, error)
	// SetTeamPermission sets permission on resource for a team
	SetTeamPermission(ctx context.Context, orgID, teamID int64, resourceID, permission string) (*ResourcePermission, error)
	// SetBuiltInRolePermission sets permission on resource for a built-in role (Admin, Editor, Viewer)
	SetBuiltInRolePermission(ctx context.Context, orgID int64, builtInRole string, resourceID string, permission string) (*ResourcePermission, error)
	// SetPermissions sets several permissions on resource for either built-in role, team or user
	SetPermissions(ctx context.Context, orgID int64, resourceID string, commands ...SetResourcePermissionCommand) ([]ResourcePermission, error)
	// MapActions will map actions for a ResourcePermissions to it's "friendly" name configured in PermissionsToActions map.
	MapActions(permission ResourcePermission) string
}

type User struct {
	ID         int64
	IsExternal bool
}

// HasGlobalAccess checks user access with globally assigned permissions only
func HasGlobalAccess(ac AccessControl, service Service, c *contextmodel.ReqContext) func(fallback func(*contextmodel.ReqContext) bool, evaluator Evaluator) bool {
	return func(fallback func(*contextmodel.ReqContext) bool, evaluator Evaluator) bool {
		if ac.IsDisabled() {
			return fallback(c)
		}

		userCopy := *c.SignedInUser
		userCopy.OrgID = GlobalOrgID
		userCopy.OrgRole = ""
		userCopy.OrgName = ""
		if userCopy.Permissions[GlobalOrgID] == nil {
			permissions, err := service.GetUserPermissions(c.Req.Context(), &userCopy, Options{})
			if err != nil {
				c.Logger.Error("failed fetching permissions for user", "userID", userCopy.UserID, "error", err)
			}
			userCopy.Permissions[GlobalOrgID] = GroupScopesByAction(permissions)
		}

		hasAccess, err := ac.Evaluate(c.Req.Context(), &userCopy, evaluator)
		if err != nil {
			c.Logger.Error("Error from access control system", "error", err)
			return false
		}

		// set on user so we don't fetch global permissions every time this is called
		c.SignedInUser.Permissions[GlobalOrgID] = userCopy.Permissions[GlobalOrgID]

		return hasAccess
	}
}

func HasAccess(ac AccessControl, c *contextmodel.ReqContext) func(fallback func(*contextmodel.ReqContext) bool, evaluator Evaluator) bool {
	return func(fallback func(*contextmodel.ReqContext) bool, evaluator Evaluator) bool {
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

var ReqSignedIn = func(c *contextmodel.ReqContext) bool {
	return c.IsSignedIn
}

var ReqGrafanaAdmin = func(c *contextmodel.ReqContext) bool {
	return c.IsGrafanaAdmin
}

// ReqViewer returns true if the current user has org.RoleViewer. Note: this can be anonymous user as well
var ReqViewer = func(c *contextmodel.ReqContext) bool {
	return c.OrgRole.Includes(org.RoleViewer)
}

var ReqOrgAdmin = func(c *contextmodel.ReqContext) bool {
	return c.OrgRole == org.RoleAdmin
}

var ReqOrgAdminOrEditor = func(c *contextmodel.ReqContext) bool {
	return c.OrgRole == org.RoleAdmin || c.OrgRole == org.RoleEditor
}

// ReqHasRole generates a fallback to check whether the user has a role
// Note that while ReqOrgAdmin returns false for a Grafana Admin / Viewer, ReqHasRole(org.RoleAdmin) will return true
func ReqHasRole(role org.RoleType) func(c *contextmodel.ReqContext) bool {
	return func(c *contextmodel.ReqContext) bool { return c.HasRole(role) }
}

func BuildPermissionsMap(permissions []Permission) map[string]bool {
	permissionsMap := make(map[string]bool)
	for _, p := range permissions {
		permissionsMap[p.Action] = true
	}

	return permissionsMap
}

// GroupScopesByAction will group scopes on action
func GroupScopesByAction(permissions []Permission) map[string][]string {
	m := make(map[string][]string)
	for i := range permissions {
		m[permissions[i].Action] = append(m[permissions[i].Action], permissions[i].Scope)
	}
	return m
}

func Reduce(ps []Permission) map[string][]string {
	reduced := make(map[string][]string)
	scopesByAction := make(map[string]map[string]bool)
	wildcardsByAction := make(map[string]map[string]bool)

	// helpers
	add := func(scopesByAction map[string]map[string]bool, action, scope string) {
		if _, ok := scopesByAction[action]; !ok {
			scopesByAction[action] = map[string]bool{scope: true}
			return
		}
		scopesByAction[action][scope] = true
	}
	includes := func(wildcardsSet map[string]bool, scope string) bool {
		for wildcard := range wildcardsSet {
			if wildcard == "*" || strings.HasPrefix(scope, wildcard[:len(wildcard)-1]) {
				return true
			}
		}
		return false
	}

	// Sort permissions (scopeless, wildcard, specific)
	for i := range ps {
		if ps[i].Scope == "" {
			if _, ok := reduced[ps[i].Action]; !ok {
				reduced[ps[i].Action] = nil
			}
			continue
		}
		if isWildcard(ps[i].Scope) {
			add(wildcardsByAction, ps[i].Action, ps[i].Scope)
			continue
		}
		add(scopesByAction, ps[i].Action, ps[i].Scope)
	}

	// Reduce wildcards
	for action, wildcards := range wildcardsByAction {
		for wildcard := range wildcards {
			if wildcard == "*" {
				reduced[action] = []string{wildcard}
				break
			}
			if includes(wildcards, wildcard[:len(wildcard)-2]) {
				continue
			}
			reduced[action] = append(reduced[action], wildcard)
		}
	}

	// Reduce specific
	for action, scopes := range scopesByAction {
		for scope := range scopes {
			if includes(wildcardsByAction[action], scope) {
				continue
			}
			reduced[action] = append(reduced[action], scope)
		}
	}

	return reduced
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

func ManagedUserRoleName(userID int64) string {
	return fmt.Sprintf("managed:users:%d:permissions", userID)
}

func ManagedTeamRoleName(teamID int64) string {
	return fmt.Sprintf("managed:teams:%d:permissions", teamID)
}

func ManagedBuiltInRoleName(builtInRole string) string {
	return fmt.Sprintf("managed:builtins:%s:permissions", strings.ToLower(builtInRole))
}

func IsDisabled(cfg *setting.Cfg) bool {
	return !cfg.RBACEnabled
}

// GetOrgRoles returns legacy org roles for a user
func GetOrgRoles(user *user.SignedInUser) []string {
	roles := []string{string(user.OrgRole)}

	if user.IsGrafanaAdmin {
		roles = append(roles, RoleGrafanaAdmin)
	}

	return roles
}

func BackgroundUser(name string, orgID int64, role org.RoleType, permissions []Permission) *user.SignedInUser {
	return &user.SignedInUser{
		OrgID:   orgID,
		OrgRole: role,
		Login:   "grafana_" + name,
		Permissions: map[int64]map[string][]string{
			orgID: GroupScopesByAction(permissions),
		},
	}
}

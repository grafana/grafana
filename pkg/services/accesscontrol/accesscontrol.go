package accesscontrol

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
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
	// DeclareFixedRoles allows the caller to declare, to the service, fixed roles and their
	// assignments to organization roles ("Viewer", "Editor", "Admin") or "Grafana Admin"
	// FIXME: Remove from access control interface and inject service where this is needed
	DeclareFixedRoles(registrations ...RoleRegistration) error
	//IsDisabled returns if access control is enabled or not
	IsDisabled() bool
}

type Service interface {
	registry.ProvidesUsageStats
	// GetUserPermissions returns user permissions with only action and scope fields set.
	GetUserPermissions(ctx context.Context, user *user.SignedInUser, options Options) ([]Permission, error)
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

type Store interface {
	// GetUserPermissions returns user permissions with only action and scope fields set.
	GetUserPermissions(ctx context.Context, query GetUserPermissionsQuery) ([]Permission, error)
	DeleteUserPermissions(ctx context.Context, orgID, userID int64) error
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

// Metadata contains user accesses for a given resource
// Ex: map[string]bool{"create":true, "delete": true}
type Metadata map[string]bool

// HasGlobalAccess checks user access with globally assigned permissions only
func HasGlobalAccess(ac AccessControl, c *models.ReqContext) func(fallback func(*models.ReqContext) bool, evaluator Evaluator) bool {
	return func(fallback func(*models.ReqContext) bool, evaluator Evaluator) bool {
		if ac.IsDisabled() {
			return fallback(c)
		}

		userCopy := *c.SignedInUser
		userCopy.OrgID = GlobalOrgID
		userCopy.OrgRole = ""
		userCopy.OrgName = ""
		hasAccess, err := ac.Evaluate(c.Req.Context(), &userCopy, evaluator)
		if err != nil {
			c.Logger.Error("Error from access control system", "error", err)
			return false
		}

		return hasAccess
	}
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

var ReqSignedIn = func(c *models.ReqContext) bool {
	return c.IsSignedIn
}

var ReqGrafanaAdmin = func(c *models.ReqContext) bool {
	return c.IsGrafanaAdmin
}

// ReqViewer returns true if the current user has org.RoleViewer. Note: this can be anonymous user as well
var ReqViewer = func(c *models.ReqContext) bool {
	return c.OrgRole.Includes(org.RoleViewer)
}

var ReqOrgAdmin = func(c *models.ReqContext) bool {
	return c.OrgRole == org.RoleAdmin
}

var ReqOrgAdminOrEditor = func(c *models.ReqContext) bool {
	return c.OrgRole == org.RoleAdmin || c.OrgRole == org.RoleEditor
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
	for _, p := range permissions {
		m[p.Action] = append(m[p.Action], p.Scope)
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

func addActionToMetadata(allMetadata map[string]Metadata, action, id string) map[string]Metadata {
	metadata, initialized := allMetadata[id]
	if !initialized {
		metadata = Metadata{action: true}
	} else {
		metadata[action] = true
	}
	allMetadata[id] = metadata
	return allMetadata
}

// GetResourcesMetadata returns a map of accesscontrol metadata, listing for each resource, users available actions
func GetResourcesMetadata(ctx context.Context, permissions map[string][]string, prefix string, resourceIDs map[string]bool) map[string]Metadata {
	rootPrefix, attributePrefix, ok := extractPrefixes(prefix)
	if !ok {
		return map[string]Metadata{}
	}

	allScope := GetResourceAllScope(strings.TrimSuffix(rootPrefix, ":"))
	allAttributeScope := Scope(strings.TrimSuffix(attributePrefix, ":"), "*")

	// index of the attribute in the scope
	attributeIndex := len(attributePrefix)

	// Loop through permissions once
	result := map[string]Metadata{}

	for action, scopes := range permissions {
		for _, scope := range scopes {
			if scope == "*" || scope == allScope || scope == allAttributeScope {
				// Add global action to all resources
				for id := range resourceIDs {
					result = addActionToMetadata(result, action, id)
				}
			} else {
				if len(scope) > attributeIndex && strings.HasPrefix(scope, attributePrefix) && resourceIDs[scope[attributeIndex:]] {
					// Add action to a specific resource
					result = addActionToMetadata(result, action, scope[attributeIndex:])
				}
			}
		}
	}

	return result
}

// MergeMeta will merge actions matching prefix of second metadata into first
func MergeMeta(prefix string, first Metadata, second Metadata) Metadata {
	if first == nil {
		first = Metadata{}
	}

	for key := range second {
		if strings.HasPrefix(key, prefix) {
			first[key] = true
		}
	}
	return first
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

func extractPrefixes(prefix string) (string, string, bool) {
	parts := strings.Split(strings.TrimSuffix(prefix, ":"), ":")
	if len(parts) != 2 {
		return "", "", false
	}
	rootPrefix := parts[0] + ":"
	attributePrefix := rootPrefix + parts[1] + ":"
	return rootPrefix, attributePrefix, true
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

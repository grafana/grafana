package accesscontrol

import (
	"context"
	"fmt"
	"strings"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/authn"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/accesscontrol")

type AccessControl interface {
	// Evaluate evaluates access to the given resources.
	Evaluate(ctx context.Context, user identity.Requester, evaluator Evaluator) (bool, error)
	// RegisterScopeAttributeResolver allows the caller to register a scope resolver for a
	// specific scope prefix (ex: datasources:name:)
	RegisterScopeAttributeResolver(prefix string, resolver ScopeAttributeResolver)
	// WithoutResolvers copies AccessControl without any configured resolvers.
	// This is useful when we don't want to reuse any pre-configured resolvers
	// for a authorization call.
	WithoutResolvers() AccessControl
}

type Service interface {
	registry.BackgroundService
	registry.ProvidesUsageStats
	// GetRoleByName returns a role by name
	GetRoleByName(ctx context.Context, orgID int64, roleName string) (*RoleDTO, error)
	// GetUserPermissions returns user permissions with only action and scope fields set.
	GetUserPermissions(ctx context.Context, user identity.Requester, options Options) ([]Permission, error)
	// SearchUsersPermissions returns all users' permissions filtered by an action prefix
	SearchUsersPermissions(ctx context.Context, user identity.Requester, options SearchOptions) (map[int64][]Permission, error)
	// ClearUserPermissionCache removes the permission cache entry for the given user
	ClearUserPermissionCache(user identity.Requester)
	// SearchUserPermissions returns single user's permissions filtered by an action prefix or an action
	SearchUserPermissions(ctx context.Context, orgID int64, filterOptions SearchOptions) ([]Permission, error)
	// DeleteUserPermissions removes all permissions user has in org and all permission to that user
	// If orgID is set to 0 remove permissions from all orgs
	DeleteUserPermissions(ctx context.Context, orgID, userID int64) error
	// DeleteTeamPermissions removes all role assignments and permissions granted to a team
	// and removes permissions scoped to the team.
	DeleteTeamPermissions(ctx context.Context, orgID, teamID int64) error
	// DeclareFixedRoles allows the caller to declare, to the service, fixed roles and their
	// assignments to organization roles ("Viewer", "Editor", "Admin") or "Grafana Admin"
	DeclareFixedRoles(registrations ...RoleRegistration) error
	// SaveExternalServiceRole creates or updates an external service's role and assigns it to a given service account id.
	SaveExternalServiceRole(ctx context.Context, cmd SaveExternalServiceRoleCommand) error
	// DeleteExternalServiceRole removes an external service's role and its assignment.
	DeleteExternalServiceRole(ctx context.Context, externalServiceID string) error
	// SyncUserRoles adds provided roles to user
	SyncUserRoles(ctx context.Context, orgID int64, cmd SyncUserRolesCommand) error
}

//go:generate  mockery --name Store --structname MockStore --outpkg actest --filename store_mock.go --output ./actest/
type Store interface {
	GetUserPermissions(ctx context.Context, query GetUserPermissionsQuery) ([]Permission, error)
	GetBasicRolesPermissions(ctx context.Context, query GetUserPermissionsQuery) ([]Permission, error)
	GetTeamsPermissions(ctx context.Context, query GetUserPermissionsQuery) (map[int64][]Permission, error)
	SearchUsersPermissions(ctx context.Context, orgID int64, options SearchOptions) (map[int64][]Permission, error)
	GetUsersBasicRoles(ctx context.Context, userFilter []int64, orgID int64) (map[int64][]string, error)
	DeleteUserPermissions(ctx context.Context, orgID, userID int64) error
	DeleteTeamPermissions(ctx context.Context, orgID, teamID int64) error
	SaveExternalServiceRole(ctx context.Context, cmd SaveExternalServiceRoleCommand) error
	DeleteExternalServiceRole(ctx context.Context, externalServiceID string) error
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
	ActionSets   []string
	Scope        string
	UserID       int64
	wildcards    Wildcards // private field computed based on the Scope
	RolePrefixes []string
}

// Wildcards computes the wildcard scopes that include the scope
func (s *SearchOptions) Wildcards() []string {
	if s.wildcards != nil {
		return s.wildcards
	}

	if s.Scope == "" {
		s.wildcards = []string{}
		return s.wildcards
	}

	s.wildcards = WildcardsFromPrefix(ScopePrefix(s.Scope))
	return s.wildcards
}

type SyncUserRolesCommand struct {
	UserID int64
	// name of roles the user should have
	RolesToAdd []string
	// name of roles the user should not have
	RolesToRemove []string
}

type TeamPermissionsService interface {
	GetPermissions(ctx context.Context, user identity.Requester, resourceID string) ([]ResourcePermission, error)
	SetUserPermission(ctx context.Context, orgID int64, user User, resourceID, permission string) (*ResourcePermission, error)
	SetPermissions(ctx context.Context, orgID int64, resourceID string, commands ...SetResourcePermissionCommand) ([]ResourcePermission, error)
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

type ReceiverPermissionsService interface {
	PermissionsService
	SetDefaultPermissions(ctx context.Context, orgID int64, user identity.Requester, uid string)
	CopyPermissions(ctx context.Context, orgID int64, user identity.Requester, oldUID, newUID string) (int, error)
}

type PermissionsService interface {
	// GetPermissions returns all permissions for given resourceID
	GetPermissions(ctx context.Context, user identity.Requester, resourceID string) ([]ResourcePermission, error)
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
	// DeleteResourcePermissions removes all permissions for a resource
	DeleteResourcePermissions(ctx context.Context, orgID int64, resourceID string) error
}

type User struct {
	ID         int64
	IsExternal bool
}

// HasGlobalAccess checks user access with globally assigned permissions only
func HasGlobalAccess(ac AccessControl, authnService authn.Service, c *contextmodel.ReqContext) func(evaluator Evaluator) bool {
	return func(evaluator Evaluator) bool {
		var targetOrgID int64 = GlobalOrgID
		orgUser, err := authnService.ResolveIdentity(c.Req.Context(), targetOrgID, c.SignedInUser.GetID())
		if err != nil {
			// This will be an common error for entities that can't authenticate in global scope
			c.Logger.Debug("Failed to authenticate user in global scope", "error", err)
			return false
		}

		hasAccess, err := ac.Evaluate(c.Req.Context(), orgUser, evaluator)
		if err != nil {
			c.Logger.Error("Error from access control system", "error", err)
			return false
		}

		// guard against nil map
		if c.SignedInUser.Permissions == nil {
			c.SignedInUser.Permissions = make(map[int64]map[string][]string)
		}
		// set on user so we don't fetch global permissions every time this is called
		c.SignedInUser.Permissions[orgUser.GetOrgID()] = orgUser.GetPermissions()

		return hasAccess
	}
}

func HasAccess(ac AccessControl, c *contextmodel.ReqContext) func(evaluator Evaluator) bool {
	return func(evaluator Evaluator) bool {
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
	return c.SignedInUser.GetIsGrafanaAdmin()
}

// ReqHasRole generates a fallback to check whether the user has a role
// ReqHasRole(org.RoleAdmin) will always return true for Grafana server admins, eg, a Grafana Admin / Viewer role combination
func ReqHasRole(role org.RoleType) func(c *contextmodel.ReqContext) bool {
	return func(c *contextmodel.ReqContext) bool { return c.SignedInUser.HasRole(role) }
}

func BuildPermissionsMap(permissions []Permission) map[string]bool {
	permissionsMap := make(map[string]bool)
	for _, p := range permissions {
		permissionsMap[p.Action] = true
	}

	return permissionsMap
}

// GroupScopesByAction will group scopes on action
//
// Deprecated: use GroupScopesByActionContext instead
func GroupScopesByAction(permissions []Permission) map[string][]string {
	return GroupScopesByActionContext(context.Background(), permissions)
}

// GroupScopesByAction will group scopes on action
func GroupScopesByActionContext(ctx context.Context, permissions []Permission) map[string][]string {
	_, span := tracer.Start(ctx, "accesscontrol.GroupScopesByActionContext", trace.WithAttributes(
		attribute.Int("permissions_count", len(permissions)),
	))
	defer span.End()

	m := make(map[string][]string)
	for i := range permissions {
		m[permissions[i].Action] = append(m[permissions[i].Action], permissions[i].Scope)
	}
	return m
}

// Reduce will reduce a list of permissions to its minimal form, grouping scopes by action
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

// GetOrgRoles returns legacy org roles for a user
func GetOrgRoles(user identity.Requester) []string {
	roles := []string{string(user.GetOrgRole())}

	if user.GetIsGrafanaAdmin() {
		if user.GetOrgID() == GlobalOrgID {
			// A server admin is the admin of the global organization
			return []string{RoleGrafanaAdmin, string(org.RoleAdmin)}
		}
		roles = append(roles, RoleGrafanaAdmin)
	}

	return roles
}

// PermissionsForActions generate Permissions for all actions provided scoped to provided scope.
func PermissionsForActions(actions []string, scope string) []Permission {
	permissions := make([]Permission, len(actions))

	for i, action := range actions {
		permissions[i] = Permission{
			Action: action,
			Scope:  scope,
		}
	}

	return permissions
}

func BackgroundUser(name string, orgID int64, role org.RoleType, permissions []Permission) identity.Requester {
	return &user.SignedInUser{
		OrgID:   orgID,
		OrgRole: role,
		Login:   "grafana_" + name,
		Permissions: map[int64]map[string][]string{
			orgID: GroupScopesByAction(permissions),
		},
	}
}

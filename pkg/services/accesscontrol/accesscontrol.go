package accesscontrol

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

type AccessControl interface {
	// Evaluate evaluates access to the given resources.
	Evaluate(ctx context.Context, user identity.Requester, evaluator Evaluator) (bool, error)
	// RegisterScopeAttributeResolver allows the caller to register a scope resolver for a
	// specific scope prefix (ex: datasources:name:)
	RegisterScopeAttributeResolver(prefix string, resolver ScopeAttributeResolver)
}

type Service interface {
	registry.ProvidesUsageStats
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
	NamespacedID string    // ID of the identity (ex: user:3, service-account:4)
	wildcards    Wildcards // private field computed based on the Scope
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

func (s *SearchOptions) ComputeUserID() (int64, error) {
	if s.NamespacedID == "" {
		return 0, errors.New("namespacedID must be set")
	}
	// Split namespaceID into namespace and ID
	parts := strings.Split(s.NamespacedID, ":")
	// Validate namespace ID format
	if len(parts) != 2 {
		return 0, fmt.Errorf("invalid namespaced ID: %s", s.NamespacedID)
	}
	// Validate namespace type is user or service account
	if parts[0] != identity.NamespaceUser && parts[0] != identity.NamespaceServiceAccount {
		return 0, fmt.Errorf("invalid namespace: %s", parts[0])
	}
	// Validate namespace ID is a number
	id, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid namespaced ID: %s", s.NamespacedID)
	}
	return id, nil
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
func HasGlobalAccess(ac AccessControl, service Service, c *contextmodel.ReqContext) func(evaluator Evaluator) bool {
	return func(evaluator Evaluator) bool {
		var targetOrgID int64 = GlobalOrgID
		tmpUser, err := makeTmpUser(c.Req.Context(), service, nil, nil, c.SignedInUser, targetOrgID)
		if err != nil {
			deny(c, nil, fmt.Errorf("failed to authenticate user in target org: %w", err))
		}

		hasAccess, err := ac.Evaluate(c.Req.Context(), tmpUser, evaluator)
		if err != nil {
			c.Logger.Error("Error from access control system", "error", err)
			return false
		}

		// set on user so we don't fetch global permissions every time this is called
		c.SignedInUser.Permissions[tmpUser.GetOrgID()] = tmpUser.GetPermissions()

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
func GroupScopesByAction(permissions []Permission) map[string][]string {
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

// intersectScopes computes the minimal list of scopes common to two slices.
func intersectScopes(s1, s2 []string) []string {
	if len(s1) == 0 || len(s2) == 0 {
		return []string{}
	}

	// helpers
	splitScopes := func(s []string) (map[string]bool, map[string]bool) {
		scopes := make(map[string]bool)
		wildcards := make(map[string]bool)
		for _, s := range s {
			if isWildcard(s) {
				wildcards[s] = true
			} else {
				scopes[s] = true
			}
		}
		return scopes, wildcards
	}
	includes := func(wildcardsSet map[string]bool, scope string) bool {
		for wildcard := range wildcardsSet {
			if wildcard == "*" || strings.HasPrefix(scope, wildcard[:len(wildcard)-1]) {
				return true
			}
		}
		return false
	}

	res := make([]string, 0)

	// split input into scopes and wildcards
	s1Scopes, s1Wildcards := splitScopes(s1)
	s2Scopes, s2Wildcards := splitScopes(s2)

	// intersect wildcards
	wildcards := make(map[string]bool)
	for s := range s1Wildcards {
		// if s1 wildcard is included in s2 wildcards
		// then it is included in the intersection
		if includes(s2Wildcards, s) {
			wildcards[s] = true
			continue
		}
	}
	for s := range s2Wildcards {
		// if s2 wildcard is included in s1 wildcards
		// then it is included in the intersection
		if includes(s1Wildcards, s) {
			wildcards[s] = true
		}
	}

	// intersect scopes
	scopes := make(map[string]bool)
	for s := range s1Scopes {
		// if s1 scope is included in s2 wilcards or s2 scopes
		// then it is included in the intersection
		if includes(s2Wildcards, s) || s2Scopes[s] {
			scopes[s] = true
		}
	}
	for s := range s2Scopes {
		// if s2 scope is included in s1 wilcards
		// then it is included in the intersection
		if includes(s1Wildcards, s) {
			scopes[s] = true
		}
	}

	// merge wildcards and scopes
	for w := range wildcards {
		res = append(res, w)
	}
	for s := range scopes {
		res = append(res, s)
	}

	return res
}

// Intersect returns the intersection of two slices of permissions, grouping scopes by action.
func Intersect(p1, p2 []Permission) map[string][]string {
	if len(p1) == 0 || len(p2) == 0 {
		return map[string][]string{}
	}

	res := make(map[string][]string)
	p1m := Reduce(p1)
	p2m := Reduce(p2)

	// Loop over the smallest map
	if len(p1m) > len(p2m) {
		p1m, p2m = p2m, p1m
	}

	for a1, s1 := range p1m {
		if s2, ok := p2m[a1]; ok {
			res[a1] = intersectScopes(s1, s2)
		}
	}

	return res
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

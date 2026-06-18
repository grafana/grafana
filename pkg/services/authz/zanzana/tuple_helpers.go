package zanzana

import (
	"errors"
	"fmt"
	"strings"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/protobuf/types/known/structpb"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"

	"github.com/grafana/grafana/pkg/infra/log"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

var (
	errEmptyName        = errors.New("name cannot be empty")
	errInvalidBasicRole = errors.New("invalid basic role")
	errUnknownKind      = errors.New("unknown permission kind")
)

// Legacy role-management actions. Kept here (instead of importing acmodels) to
// avoid an extension/legacy package dependency from the shared zanzana helpers.
const (
	actionRolesRead   = "roles:read"
	actionRolesWrite  = "roles:write"
	actionRolesDelete = "roles:delete"
)

// User-management actions. Hardcoded for the same reason as the role-management
// actions above: the enterprise-only users.roles:* actions live in pkg/extensions
// and these shared helpers must not depend on it.
const (
	actionUsersCreate = "users:create"
	actionUsersRead   = "users:read"
	actionUsersWrite  = "users:write"
	actionUsersDelete = "users:delete"

	actionUsersPermissionsRead  = "users.permissions:read"
	actionUsersPermissionsWrite = "users.permissions:write"

	actionUsersRolesRead   = "users.roles:read"
	actionUsersRolesAdd    = "users.roles:add"
	actionUsersRolesRemove = "users.roles:remove"

	actionOrgUsersRead   = "org.users:read"
	actionOrgUsersWrite  = "org.users:write"
	actionOrgUsersAdd    = "org.users:add"
	actionOrgUsersRemove = "org.users:remove"
)

// Team-management actions. Hardcoded for the same reason as the user-management
// actions above (the enterprise-only teams.roles:* actions live in pkg/extensions).
const (
	actionTeamsRolesRead   = "teams.roles:read"
	actionTeamsRolesAdd    = "teams.roles:add"
	actionTeamsRolesRemove = "teams.roles:remove"
)

// iam.grafana.app group and the resources user- and team-management actions gate.
var (
	iamGroup             = iamv0.UserResourceInfo.GroupResource().Group
	usersResource        = iamv0.UserResourceInfo.GroupResource().Resource
	teamsResource        = iamv0.TeamResourceInfo.GroupResource().Resource
	roleBindingsResource = iamv0.RoleBindingInfo.GroupResource().Resource
)

// iamActionMapping describes the group_resource (within iamGroup) and relation(s) an
// iam-management action grants. Shared by the user- and team-management mappings.
type iamActionMapping struct {
	resource  string
	relations []string
	// skipScope marks actions the mapper authorizes without a scope (create verbs).
	skipScope bool
}

// userManagementMappings maps each user-management action to the iam group_resource
// relation(s) it grants.
//
// On iam.grafana.app/users the global (users:*) and org (org.users:*) families gate
// the same verbs, so both map to the same relation. This union is safe because the
// privileged changes (grafanaAdmin, disabled, profile vs. org role) are gated by the
// iam admission validators (pkg/registry/apis/iam/user/validate.go) independently of
// this grant — so the relation only decides "may you attempt this verb".
//
// users.roles:* gate rolebindings, not users. Actions with no iam verb
// (users:enable/disable/logout, users.authtoken/password/quotas) gate only legacy HTTP
// endpoints and are omitted.
var userManagementMappings = map[string]iamActionMapping{
	actionUsersRead:    {resource: usersResource, relations: []string{RelationGet}},
	actionOrgUsersRead: {resource: usersResource, relations: []string{RelationGet}},

	actionUsersWrite:    {resource: usersResource, relations: []string{RelationUpdate}},
	actionOrgUsersWrite: {resource: usersResource, relations: []string{RelationUpdate}},

	actionUsersCreate: {resource: usersResource, relations: []string{RelationCreate}, skipScope: true},
	// Skipping this one until we have a better picture of the whole org permissions
	// actionOrgUsersAdd: {resource: usersResource, relations: []string{RelationCreate}},

	actionUsersDelete:    {resource: usersResource, relations: []string{RelationDelete}},
	actionOrgUsersRemove: {resource: usersResource, relations: []string{RelationDelete}},

	actionUsersPermissionsRead:  {resource: usersResource, relations: []string{RelationGetPermissions}},
	actionUsersPermissionsWrite: {resource: usersResource, relations: []string{RelationSetPermissions}},

	actionUsersRolesRead:   {resource: roleBindingsResource, relations: []string{RelationGet}},
	actionUsersRolesAdd:    {resource: roleBindingsResource, relations: []string{RelationCreate, RelationUpdate}},
	actionUsersRolesRemove: {resource: roleBindingsResource, relations: []string{RelationDelete}},
}

// teamRoleBindingMappings maps each team-management action to the iam group_resource
// relation(s) it grants, inverting the iam "teams" and "rolebindings" mapper entries.
// Core team actions gate iam.grafana.app/teams; teams.roles:* gate
// iam.grafana.app/rolebindings (the same resource user role-bindings gate — team and
// user role-assignments are not distinguished at the group_resource level).
var teamRoleBindingMappings = map[string]iamActionMapping{
	actionTeamsRolesRead:   {resource: roleBindingsResource, relations: []string{RelationGet}},
	actionTeamsRolesAdd:    {resource: roleBindingsResource, relations: []string{RelationCreate, RelationUpdate}},
	actionTeamsRolesRemove: {resource: roleBindingsResource, relations: []string{RelationDelete}},
}

// Scope fragments produced by splitScope for the two "all roles" scopes we
// honor when translating role-management permissions:
//   - permissions:type:delegate → kind="permissions", identifier="delegate"
//   - roles:*                   → kind="roles",       identifier="*"
//
// The K8s mapper for roles already treats `permissions:type:delegate` as
// equivalent to `roles:*` (see pkg/services/authz/rbac/mapper.go), so both
// scope shapes resolve to the same wildcard group_resource tuple here.
const (
	scopeKindPermissions    = "permissions"
	scopeIdentifierDelegate = "delegate"
	scopeKindRoles          = "roles"
	scopeIdentifierWildcard = "*"
)

// TupleStringWithoutCondition returns the string representation of a tuple without its condition.
// This is useful for deduplicating tuples that have the same user, relation, and object
// but different conditions that need to be merged.
func TupleStringWithoutCondition(tuple *openfgav1.TupleKey) string {
	c := tuple.Condition
	tuple.Condition = nil
	s := tuple.String()
	tuple.Condition = c
	return s
}

// RolePermission represents a permission that can be converted to a Zanzana tuple.
type RolePermission struct {
	Action     string
	Kind       string
	Identifier string
}

// ConvertRolePermissionsToTuples converts role permissions to Zanzana tuples with proper merging.
// It handles:
// - Translation of RBAC action/kind/identifier to Zanzana tuples
// - Special handling for folder resource tuples (which need to be merged)
// - Deduplication of tuples
//
// Returns a slice of tuples ready to be written to Zanzana, or nil if no valid tuples could be created.
func ConvertRolePermissionsToTuples(roleUID string, permissions []RolePermission) ([]*openfgav1.TupleKey, error) {
	if len(permissions) == 0 {
		return nil, nil
	}

	// Subject for role permissions: role:{uid}#assignee
	subject := NewTupleEntry(TypeRole, roleUID, RelationAssignee)

	// Use a map to track tuples, with special handling for folder resource tuples
	tupleMap := make(map[string]*openfgav1.TupleKey)
	folderResourceTuples := make(map[string]*openfgav1.TupleKey) // key is tuple without condition

	for _, perm := range permissions {
		// Role-management actions (roles:read/write/delete) take a dedicated
		// translation path — their scope kinds (permissions:type:delegate,
		// roles:*) aren't in the standard resource translation table, so
		// falling through to TranslateToResourceTuple would log a misleading
		// "can't translate" message. Non-wildcard scopes on role-management
		// actions are intentionally dropped (see RoleManagementToTuples).
		if isRoleManagementAction(perm.Action) {
			for _, t := range RoleManagementToTuples(subject, perm) {
				tupleMap[t.String()] = t
			}
			continue
		}

		// User-management actions map onto iam group_resources via a dedicated path,
		// like the role-management actions above (see UserManagementToTuples).
		if isUserManagementAction(perm.Action) {
			for _, t := range UserManagementToTuples(subject, perm) {
				tupleMap[t.String()] = t
			}
			continue
		}

		// Team-management actions map onto iam group_resources via a dedicated path,
		// like the user-management actions above (see TeamManagementToTuples).
		if isTeamManagementAction(perm.Action) {
			for _, t := range TeamRoleBindingManagementToTuples(subject, perm) {
				tupleMap[t.String()] = t
			}
			continue
		}

		// Convert RBAC action/kind to Zanzana tuple
		tuple, ok := TranslateToResourceTuple(subject, perm.Action, perm.Kind, perm.Identifier)
		if !ok {
			// Skip permissions that can't be translated
			log.New("zanzana").Debug("skipping permission that can't be translated", "permission", perm)
			continue
		}

		// Handle folder resource tuples specially - they need to be merged
		if IsFolderResourceTuple(tuple) {
			// Create a key without the condition for deduplication
			key := TupleStringWithoutCondition(tuple)
			if existing, exists := folderResourceTuples[key]; exists {
				// Merge this tuple with the existing one
				MergeFolderResourceTuples(existing, tuple)
			} else {
				folderResourceTuples[key] = tuple
			}
			continue
		}

		// For non-folder resource tuples, just add to the map
		tupleMap[tuple.String()] = tuple
	}

	// Collect all tuples
	tuples := make([]*openfgav1.TupleKey, 0, len(tupleMap)+len(folderResourceTuples))
	for _, t := range tupleMap {
		tuples = append(tuples, t)
	}
	for _, t := range folderResourceTuples {
		tuples = append(tuples, t)
	}

	return tuples, nil
}

// RoleToTuples converts role and its permissions (action/scope) to v1 TupleKey format
// using the shared ConvertRolePermissionsToTuples utility and common.ToAuthzExtTupleKeys
func RoleToTuples(roleUID string, permissions []*authzextv1.RolePermission) ([]*openfgav1.TupleKey, error) {
	// Convert to RolePermission
	rolePerms := make([]RolePermission, 0, len(permissions))
	for _, perm := range permissions {
		// Split the scope to get kind, attribute, identifier
		kind, _, identifier := splitScope(perm.Scope)
		rolePerms = append(rolePerms, RolePermission{
			Action:     perm.Action,
			Kind:       kind,
			Identifier: identifier,
		})
	}

	// Translate to Zanzana tuples
	tuples, err := ConvertRolePermissionsToTuples(roleUID, rolePerms)
	if err != nil {
		return nil, err
	}

	return tuples, nil
}

// RoleManagementToTuples returns the Zanzana tuples that grant a role the
// ability to manage other roles in the namespace and/or read global roles,
// based on its legacy role-management permissions.
//
// The legacy RBAC layer scopes role-management actions in two equivalent
// shapes that both mean "any role" — `permissions:type:delegate` (the
// canonical form for write/delete) and `roles:*` (the wildcard form used by
// `roles:read`). We treat the two as interchangeable here, matching the
// rbac mapper's behavior.
//
// Only wildcard-scoped permissions produce tuples. The FGA schema for
// `iam.grafana.app` only exposes a `group_resource` type — there is no
// per-role instance type — so a permission scoped to a specific role
// (e.g. `roles:uid:<specific>`) cannot be expressed in Zanzana without
// silently broadening the grant to all roles, and is therefore dropped.
//
// Mapping (subject is `role:<roleUID>#assignee`, wildcard scope required):
//
//   - `roles:read`   → `get`    on group_resource:iam.grafana.app/roles AND
//     `get` on group_resource:iam.grafana.app/globalroles
//     (the legacy `roles:read` action covers both APIs — see
//     pkg/services/authz/rbac/mapper.go, where `globalroles` is wired with
//     `useWildcardScope: true`).
//
//   - `roles:write`  → `edit`   on group_resource:iam.grafana.app/roles.
//     `edit` is used (instead of `update`) because the FGA schema defines
//     create/update/delete on group_resource as `... or edit`, and the legacy
//     `roles:write` action covers create + update + patch + delete.
//
//   - `roles:delete` → `delete` on group_resource:iam.grafana.app/roles.
func RoleManagementToTuples(subject string, permission RolePermission) []*openfgav1.TupleKey {
	rolesGroup := iamv0.RoleInfo.GroupResource().Group
	rolesResource := iamv0.RoleInfo.GroupResource().Resource
	globalRolesResource := iamv0.GlobalRoleInfo.GroupResource().Resource

	if !isRolesWildcardScope(permission.Kind, permission.Identifier) {
		return nil
	}

	var tuples []*openfgav1.TupleKey
	switch permission.Action {
	case actionRolesRead:
		tuples = append(tuples,
			NewGroupResourceTuple(subject, RelationGet, rolesGroup, globalRolesResource, ""),
			NewGroupResourceTuple(subject, RelationGet, rolesGroup, rolesResource, ""),
		)
	case actionRolesWrite:
		tuples = append(tuples,
			NewGroupResourceTuple(subject, RelationSetEdit, rolesGroup, rolesResource, ""),
		)
	case actionRolesDelete:
		tuples = append(tuples,
			NewGroupResourceTuple(subject, RelationDelete, rolesGroup, rolesResource, ""),
		)
	}
	return tuples
}

// isRoleManagementAction reports whether the action is one of the legacy
// role-management actions (roles:read/write/delete). These take a dedicated
// translation path in ConvertRolePermissionsToTuples — see RoleManagementToTuples.
func isRoleManagementAction(action string) bool {
	switch action {
	case actionRolesRead, actionRolesWrite, actionRolesDelete:
		return true
	}
	return false
}

// isRolesWildcardScope reports whether the (kind, identifier) pair represents
// an "all roles" scope. Both legacy shapes resolve to true:
//   - permissions:type:delegate → kind="permissions", identifier="delegate"
//   - roles:*                   → kind="roles",       identifier="*"
func isRolesWildcardScope(kind, identifier string) bool {
	if kind == scopeKindPermissions && identifier == scopeIdentifierDelegate {
		return true
	}
	if kind == scopeKindRoles && identifier == scopeIdentifierWildcard {
		return true
	}
	return false
}

// UserManagementToTuples translates a user-management permission into iam tuples.
// Only "all" scopes translate (see isAllUsersScope); specific-instance scopes are
// dropped, since the FGA users type is uid-based while the legacy scope is id-based
// and rolebindings is wildcard-only. users:create is unscoped and always translates.
func UserManagementToTuples(subject string, permission RolePermission) []*openfgav1.TupleKey {
	m, ok := userManagementMappings[permission.Action]
	if !ok {
		return nil
	}

	if !m.skipScope && !isAllUsersScope(permission.Kind, permission.Identifier) {
		return nil
	}

	tuples := make([]*openfgav1.TupleKey, 0, len(m.relations))
	for _, relation := range m.relations {
		tuples = append(tuples, NewGroupResourceTuple(subject, relation, iamGroup, m.resource, ""))
	}
	return tuples
}

// isUserManagementAction reports whether the action is one of the user-management
// actions handled by UserManagementToTuples.
func isUserManagementAction(action string) bool {
	_, ok := userManagementMappings[action]
	return ok
}

// isAllUsersScope reports whether the (kind, identifier) pair represents an "all"
// scope for the user-management actions. The legacy shapes that appear are:
//   - users:* / global.users:*  → identifier="*" (users.permissions:*, users:delete, users.roles:read)
//   - permissions:type:delegate → kind="permissions", identifier="delegate" (users.roles:add/remove)
//
// Specific instance scopes (e.g. users:id:5) match none of these and are dropped.
func isAllUsersScope(kind, identifier string) bool {
	if identifier == scopeIdentifierWildcard {
		return true
	}
	return kind == scopeKindPermissions && identifier == scopeIdentifierDelegate
}

// TeamRoleBindingManagementToTuples translates teams.roles:* actions into iam
// group_resource tuples. Only wildcard scopes translate; specific-instance scopes
// are dropped since rolebindings have no per-instance FGA type.
func TeamRoleBindingManagementToTuples(subject string, permission RolePermission) []*openfgav1.TupleKey {
	m, ok := teamRoleBindingMappings[permission.Action]
	if !ok {
		return nil
	}

	if !isAllTeamsScope(permission.Kind, permission.Identifier) {
		return nil
	}

	tuples := make([]*openfgav1.TupleKey, 0, len(m.relations))
	for _, relation := range m.relations {
		tuples = append(tuples, NewGroupResourceTuple(subject, relation, iamGroup, m.resource, ""))
	}
	return tuples
}

// isTeamManagementAction reports whether the action is one of the team-management
// actions handled by TeamManagementToTuples.
func isTeamManagementAction(action string) bool {
	_, ok := teamRoleBindingMappings[action]
	return ok
}

// isAllTeamsScope reports whether the (kind, identifier) pair represents an "all"
// scope for the team-management actions. The legacy shapes that appear are:
//   - teams:* / teams:id:*      → identifier="*" (teams:read/write/delete, teams.permissions:*, teams.roles:read)
//   - permissions:type:delegate → kind="permissions", identifier="delegate" (teams.roles:add/remove)
//
// Specific instance scopes (e.g. teams:id:5) match none of these and are dropped.
func isAllTeamsScope(kind, identifier string) bool {
	if identifier == scopeIdentifierWildcard {
		return true
	}
	return kind == scopeKindPermissions && identifier == scopeIdentifierDelegate
}

func splitScope(scope string) (string, string, string) {
	if scope == "" {
		return "", "", ""
	}

	fragments := strings.Split(scope, ":")
	switch l := len(fragments); l {
	case 1: // Splitting a wildcard scope "*" -> kind: "*"; attribute: "*"; identifier: "*"
		return fragments[0], fragments[0], fragments[0]
	case 2: // Splitting a wildcard scope with specified kind "dashboards:*" -> kind: "dashboards"; attribute: "*"; identifier: "*"
		return fragments[0], fragments[1], fragments[1]
	default: // Splitting a scope with all fields specified "dashboards:uid:my_dash" -> kind: "dashboards"; attribute: "uid"; identifier: "my_dash"
		return fragments[0], fragments[1], strings.Join(fragments[2:], ":")
	}
}

func GetRoleBindingTuple(subjectKind string, subjectName string, roleName string) (*openfgav1.TupleKey, error) {
	zanzanaType := ""
	subjectRelation := ""

	switch subjectKind {
	case string(iamv0.RoleBindingSpecSubjectKindUser):
		zanzanaType = TypeUser
	case string(iamv0.RoleBindingSpecSubjectKindTeam):
		zanzanaType = TypeTeam
		subjectRelation = RelationTeamMember
	case string(iamv0.RoleBindingSpecSubjectKindServiceAccount):
		zanzanaType = TypeServiceAccount
	default:
		return nil, fmt.Errorf("invalid subject kind: %s", subjectKind)
	}

	tuple := &openfgav1.TupleKey{
		User:     NewTupleEntry(zanzanaType, subjectName, subjectRelation),
		Relation: RelationAssignee,
		Object:   NewTupleEntry(TypeRole, roleName, ""),
	}

	return tuple, nil
}

func GetResourcePermissionWriteTuple(req *authzextv1.CreatePermissionOperation) (*openfgav1.TupleKey, error) {
	resource := req.GetResource()
	permission := req.GetPermission()
	object := NewObjectEntry(toZanzanaType(resource.GetGroup()), resource.GetGroup(), resource.GetResource(), "", resource.GetName())
	tuple, err := NewResourceTuple(object, resource, permission)
	if err != nil {
		return nil, err
	}

	return tuple, nil
}

func GetResourcePermissionDeleteTuple(req *authzextv1.DeletePermissionOperation) (*openfgav1.TupleKeyWithoutCondition, error) {
	resource := req.GetResource()
	permission := req.GetPermission()
	object := NewObjectEntry(toZanzanaType(resource.GetGroup()), resource.GetGroup(), resource.GetResource(), "", resource.GetName())
	tuple, err := NewResourceTuple(object, resource, permission)
	if err != nil {
		return nil, err
	}

	return &openfgav1.TupleKeyWithoutCondition{
		User:     tuple.GetUser(),
		Relation: tuple.GetRelation(),
		Object:   tuple.GetObject(),
	}, nil
}

func toZanzanaType(apiGroup string) string {
	if apiGroup == "folder.grafana.app" {
		return TypeFolder
	}
	return TypeResource
}

func NewResourceTuple(object string, resource *authzextv1.Resource, perm *authzextv1.Permission) (*openfgav1.TupleKey, error) {
	// Typ is "folder" or "resource"
	typ := toZanzanaType(resource.Group)

	// subject
	subject, err := toZanzanaSubject(perm.GetKind(), perm.GetName())
	if err != nil {
		return nil, err
	}

	key := &openfgav1.TupleKey{
		// e.g. "user:{uid}", "serviceaccount:{uid}", "team:{uid}", "basicrole:{viewer|editor|admin}"
		User: subject,
		// "view", "edit", "admin"
		Relation: strings.ToLower(perm.Verb),
		// e.g. "folder:{name}" or "resource:{apiGroup}/{resource}/{name}"
		Object: object,
	}

	// For resources we add a condition to filter by apiGroup/resource
	// e.g "group_filter": {"group_resource": "dashboard.grafana.app/dashboards"}
	if typ == TypeResource {
		key.Condition = &openfgav1.RelationshipCondition{
			Name: "group_filter",
			Context: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"group_resource": structpb.NewStringValue(
						resource.GetGroup() + "/" + resource.GetResource(),
					),
				},
			},
		}
	}

	return key, nil
}

func toZanzanaSubject(kind string, name string) (string, error) {
	if name == "" {
		return "", errEmptyName
	}
	iamKind := iamv0.ResourcePermissionSpecPermissionKind(kind)
	switch iamKind {
	case iamv0.ResourcePermissionSpecPermissionKindUser:
		return NewTupleEntry(TypeUser, name, ""), nil
	case iamv0.ResourcePermissionSpecPermissionKindServiceAccount:
		return NewTupleEntry(TypeServiceAccount, name, ""), nil
	case iamv0.ResourcePermissionSpecPermissionKindTeam:
		return NewTupleEntry(TypeTeam, name, RelationTeamMember), nil
	case iamv0.ResourcePermissionSpecPermissionKindBasicRole:
		basicRole := TranslateBasicRole(name)
		if basicRole == "" {
			return "", fmt.Errorf("%w: %s", errInvalidBasicRole, name)
		}

		// e.g role:basic_viewer#assignee
		return NewTupleEntry(TypeRole, basicRole, RelationAssignee), nil
	}

	// should not happen since we are after create
	// validation webhook should have caught invalid kinds
	return "", errUnknownKind
}

// GetTeamMemberTuple maps a team binding subject, team name, and permission to the corresponding
// Zanzana tuple. This is the canonical mapping used throughout the system.
func GetTeamMemberTuple(subject string, team string, permission string) (*openfgav1.TupleKey, error) {
	if subject == "" {
		return nil, errors.New("subject name cannot be empty")
	}

	if team == "" {
		return nil, errors.New("team name cannot be empty")
	}

	relation := ""
	switch permission {
	case string(iamv0.TeamBindingTeamPermissionAdmin):
		relation = RelationTeamAdmin
	case string(iamv0.TeamBindingTeamPermissionMember):
		relation = RelationTeamMember
	default:
		return nil, fmt.Errorf("unknown team permission '%s', expected member or admin", permission)
	}

	tuple := &openfgav1.TupleKey{
		User:     NewTupleEntry(TypeUser, subject, ""),
		Relation: relation,
		Object:   NewTupleEntry(TypeTeam, team, ""),
	}

	return tuple, nil
}

package resourcepermissions

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func NewStore(cfg *setting.Cfg, sql db.DB, features featuremgmt.FeatureToggles) *store {
	store := &store{cfg: cfg, sql: sql, features: features}
	return store
}

type store struct {
	cfg      *setting.Cfg
	sql      db.DB
	features featuremgmt.FeatureToggles
}

type flatResourcePermission struct {
	ID               int64 `xorm:"id"`
	RoleName         string
	Action           string
	Scope            string
	UserId           int64
	UserLogin        string
	UserEmail        string
	TeamId           int64
	TeamEmail        string
	Team             string
	BuiltInRole      string
	IsServiceAccount bool `xorm:"is_service_account"`
	Created          time.Time
	Updated          time.Time
}

func (p *flatResourcePermission) IsManaged(scope string) bool {
	return strings.HasPrefix(p.RoleName, accesscontrol.ManagedRolePrefix) && p.Scope == scope
}

// IsInherited returns true for scopes from managed permissions that don't directly match the required scope
// (ie, managed permissions on a parent resource)
func (p *flatResourcePermission) IsInherited(scope string) bool {
	return strings.HasPrefix(p.RoleName, accesscontrol.ManagedRolePrefix) && p.Scope != scope
}

type DeleteResourcePermissionsCmd struct {
	Resource          string
	ResourceAttribute string
	ResourceID        string
}

func (s *store) DeleteResourcePermissions(ctx context.Context, orgID int64, cmd *DeleteResourcePermissionsCmd) error {
	ctx, span := tracer.Start(ctx, "accesscontrol.resourcepermissions.DeleteResourcePermissions")
	defer span.End()

	scope := accesscontrol.Scope(cmd.Resource, cmd.ResourceAttribute, cmd.ResourceID)

	err := s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var permissionIDs []int64
		err := sess.SQL(
			"SELECT permission.id FROM permission INNER JOIN role ON permission.role_id = role.id WHERE permission.scope = ? AND role.org_id = ?",
			scope, orgID).Find(&permissionIDs)
		if err != nil {
			return err
		}

		if err := deletePermissions(sess, permissionIDs); err != nil {
			return err
		}
		return err
	})

	return err
}

func (s *store) SetUserResourcePermission(
	ctx context.Context, orgID int64, usr accesscontrol.User,
	cmd SetResourcePermissionCommand,
	hook UserResourceHookFunc,
) (*accesscontrol.ResourcePermission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.resourcepermissions.SetUserResourcePermission")
	defer span.End()

	if usr.ID == 0 {
		return nil, user.ErrUserNotFound
	}

	var err error
	var permission *accesscontrol.ResourcePermission
	err = s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		permission, err = s.setUserResourcePermission(sess, orgID, usr, cmd, hook)
		return err
	})

	return permission, err
}
func (s *store) setUserResourcePermission(
	sess *db.Session, orgID int64, user accesscontrol.User,
	cmd SetResourcePermissionCommand,
	hook UserResourceHookFunc,
) (*accesscontrol.ResourcePermission, error) {
	permission, err := s.setResourcePermission(sess, orgID, accesscontrol.ManagedUserRoleName(user.ID), s.userAdder(sess, orgID, user.ID), cmd)
	if err != nil {
		return nil, err
	}

	if hook != nil {
		if err := hook(sess, orgID, user, cmd.ResourceID, cmd.Permission); err != nil {
			return nil, err
		}
	}

	return permission, nil
}

func (s *store) SetTeamResourcePermission(
	ctx context.Context, orgID, teamID int64,
	cmd SetResourcePermissionCommand,
	hook TeamResourceHookFunc,
) (*accesscontrol.ResourcePermission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.resourcepermissions.SetTeamResourcePermission")
	defer span.End()

	if teamID == 0 {
		return nil, team.ErrTeamNotFound
	}

	var err error
	var permission *accesscontrol.ResourcePermission

	err = s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		permission, err = s.setTeamResourcePermission(sess, orgID, teamID, cmd, hook)
		return err
	})

	return permission, err
}

func (s *store) setTeamResourcePermission(
	sess *db.Session, orgID, teamID int64,
	cmd SetResourcePermissionCommand,
	hook TeamResourceHookFunc,
) (*accesscontrol.ResourcePermission, error) {
	permission, err := s.setResourcePermission(sess, orgID, accesscontrol.ManagedTeamRoleName(teamID), s.teamAdder(sess, orgID, teamID), cmd)
	if err != nil {
		return nil, err
	}

	if hook != nil {
		if err := hook(sess, orgID, teamID, cmd.ResourceID, cmd.Permission); err != nil {
			return nil, err
		}
	}

	return permission, nil
}

func (s *store) SetBuiltInResourcePermission(
	ctx context.Context, orgID int64, builtInRole string,
	cmd SetResourcePermissionCommand,
	hook BuiltinResourceHookFunc,
) (*accesscontrol.ResourcePermission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.resourcepermissions.SetBuiltInResourcePermission")
	defer span.End()

	if !org.RoleType(builtInRole).IsValid() || builtInRole == accesscontrol.RoleGrafanaAdmin {
		return nil, fmt.Errorf("invalid role: %s", builtInRole)
	}

	var err error
	var permission *accesscontrol.ResourcePermission

	err = s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		permission, err = s.setBuiltInResourcePermission(sess, orgID, builtInRole, cmd, hook)
		return err
	})

	if err != nil {
		return nil, err
	}

	return permission, nil
}

func (s *store) setBuiltInResourcePermission(
	sess *db.Session, orgID int64, builtInRole string,
	cmd SetResourcePermissionCommand,
	hook BuiltinResourceHookFunc,
) (*accesscontrol.ResourcePermission, error) {
	permission, err := s.setResourcePermission(sess, orgID, accesscontrol.ManagedBuiltInRoleName(builtInRole), s.builtInRoleAdder(sess, orgID, builtInRole), cmd)
	if err != nil {
		return nil, err
	}

	if hook != nil {
		if err := hook(sess, orgID, builtInRole, cmd.ResourceID, cmd.Permission); err != nil {
			return nil, err
		}
	}

	return permission, nil
}

func (s *store) SetResourcePermissions(
	ctx context.Context, orgID int64,
	commands []SetResourcePermissionsCommand,
	hooks ResourceHooks,
) ([]accesscontrol.ResourcePermission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.resourcepermissions.SetResourcePermissions")
	defer span.End()

	var err error
	var permissions []accesscontrol.ResourcePermission

	err = s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		for _, cmd := range commands {
			var p *accesscontrol.ResourcePermission
			if cmd.User.ID != 0 {
				p, err = s.setUserResourcePermission(sess, orgID, cmd.User, cmd.SetResourcePermissionCommand, hooks.User)
			} else if cmd.TeamID != 0 {
				p, err = s.setTeamResourcePermission(sess, orgID, cmd.TeamID, cmd.SetResourcePermissionCommand, hooks.Team)
			} else if org.RoleType(cmd.BuiltinRole).IsValid() || cmd.BuiltinRole == accesscontrol.RoleGrafanaAdmin {
				p, err = s.setBuiltInResourcePermission(sess, orgID, cmd.BuiltinRole, cmd.SetResourcePermissionCommand, hooks.BuiltInRole)
			}
			if err != nil {
				return err
			}
			if p != nil {
				permissions = append(permissions, *p)
			}
		}

		return nil
	})

	return permissions, err
}

type roleAdder func(roleID int64) error

func (s *store) setResourcePermission(
	sess *db.Session, orgID int64, roleName string, adder roleAdder, cmd SetResourcePermissionCommand,
) (*accesscontrol.ResourcePermission, error) {
	role, err := s.getOrCreateManagedRole(sess, orgID, roleName, adder)
	if err != nil {
		return nil, err
	}

	rawSQL := `SELECT p.* FROM permission as p INNER JOIN role r on r.id = p.role_id WHERE r.id = ? AND p.scope = ?`

	var current []accesscontrol.Permission
	scope := accesscontrol.Scope(cmd.Resource, cmd.ResourceAttribute, cmd.ResourceID)
	if err := sess.SQL(rawSQL, role.ID, scope).Find(&current); err != nil {
		return nil, err
	}

	missing := make(map[string]struct{}, len(cmd.Actions))
	for _, a := range cmd.Actions {
		missing[a] = struct{}{}
	}

	var remove []int64
	for _, p := range current {
		if _, ok := missing[p.Action]; ok {
			delete(missing, p.Action)
		} else if !ok {
			remove = append(remove, p.ID)
		}
	}

	if err := deletePermissions(sess, remove); err != nil {
		return nil, err
	}

	if err := s.createPermissions(sess, role.ID, cmd, missing); err != nil {
		return nil, err
	}

	permissions, err := s.getPermissions(sess, cmd.Resource, cmd.ResourceID, cmd.ResourceAttribute, role.ID)
	if err != nil {
		return nil, err
	}

	permission := flatPermissionsToResourcePermission(scope, permissions)
	if permission == nil {
		return &accesscontrol.ResourcePermission{}, nil
	}

	return permission, nil
}

func (s *store) GetResourcePermissions(ctx context.Context, orgID int64, query GetResourcePermissionsQuery) ([]accesscontrol.ResourcePermission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.resourcepermissions.GetResourcePermissions")
	defer span.End()

	var result []accesscontrol.ResourcePermission

	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		result, err = s.getResourcePermissions(sess, orgID, query)
		return err
	})

	return result, err
}

func (s *store) getResourcePermissions(sess *db.Session, orgID int64, query GetResourcePermissionsQuery) ([]accesscontrol.ResourcePermission, error) {
	if len(query.Actions) == 0 {
		return nil, nil
	}

	rawSelect := `
	SELECT
		p.*,
		r.name as role_name,
	`

	userSelect := rawSelect + `
		ur.user_id AS user_id,
		u.login AS user_login,
		u.is_service_account AS is_service_account,
		u.email AS user_email,
		0 AS team_id,
		'' AS team,
		'' AS team_email,
		'' AS built_in_role
	`

	teamSelect := rawSelect + `
		0 AS user_id,
		'' AS user_login,
		` + s.sql.GetDialect().BooleanStr(false) + ` AS is_service_account,
		'' AS user_email,
		tr.team_id AS team_id,
		t.name AS team,
		t.email AS team_email,
		'' AS built_in_role
	`

	builtinSelect := rawSelect + `
		0 AS user_id,
		'' AS user_login,
		` + s.sql.GetDialect().BooleanStr(false) + ` AS is_service_account,
		'' AS user_email,
		0 as team_id,
		'' AS team,
		'' AS team_email,
		br.role AS built_in_role
	`

	rawFrom := `
	FROM permission p
		INNER JOIN role r ON p.role_id = r.id
    `
	userFrom := rawFrom + `
		INNER JOIN user_role ur ON r.id = ur.role_id AND (ur.org_id = 0 OR ur.org_id = ?)
		INNER JOIN ` + s.sql.GetDialect().Quote("user") + ` u ON ur.user_id = u.id
	`
	teamFrom := rawFrom + `
		INNER JOIN team_role tr ON r.id = tr.role_id AND (tr.org_id = 0 OR tr.org_id = ?)
		INNER JOIN team t ON tr.team_id = t.id
	`

	builtinFrom := rawFrom + `
		INNER JOIN builtin_role br ON r.id = br.role_id AND (br.org_id = 0 OR br.org_id = ?)
	`

	where := `WHERE (r.org_id = ? OR r.org_id = 0) AND (p.scope = '*' OR p.scope = ? OR p.scope = ? OR p.scope = ?`

	scope := accesscontrol.Scope(query.Resource, query.ResourceAttribute, query.ResourceID)

	args := []any{
		orgID,
		orgID,
		accesscontrol.Scope(query.Resource, "*"),
		accesscontrol.Scope(query.Resource, query.ResourceAttribute, "*"),
		scope,
	}

	if len(query.InheritedScopes) > 0 {
		where += ` OR p.scope IN(?` + strings.Repeat(",?", len(query.InheritedScopes)-1) + `)`
		for _, scope := range query.InheritedScopes {
			args = append(args, scope)
		}
	}

	where += `) AND p.action IN (?` + strings.Repeat(",?", len(query.Actions)-1) + `)`

	if query.OnlyManaged {
		where += `AND r.name LIKE 'managed:%'`
	}

	for _, a := range query.Actions {
		args = append(args, a)
	}

	initialLength := len(args)
	userQuery := userSelect + userFrom + where
	if query.EnforceAccessControl {
		userFilter, err := accesscontrol.Filter(query.User, "u.id", "users:id:", accesscontrol.ActionOrgUsersRead)
		if err != nil {
			return nil, err
		}

		filter := "((" + userFilter.Where + " AND NOT u.is_service_account)"

		saFilter, err := accesscontrol.Filter(query.User, "u.id", "serviceaccounts:id:", serviceaccounts.ActionRead)
		if err != nil {
			return nil, err
		}

		filter += " OR (" + saFilter.Where + " AND u.is_service_account))"

		userQuery += " AND " + filter
		args = append(args, userFilter.Args...)
		args = append(args, saFilter.Args...)
	}

	teamFilter, err := accesscontrol.Filter(query.User, "t.id", "teams:id:", accesscontrol.ActionTeamsRead)
	if err != nil {
		return nil, err
	}

	team := teamSelect + teamFrom + where + " AND " + teamFilter.Where
	args = append(args, args[:initialLength]...)
	args = append(args, teamFilter.Args...)

	builtin := builtinSelect + builtinFrom + where
	args = append(args, args[:initialLength]...)

	sql := userQuery + " UNION " + team + " UNION " + builtin
	queryResults := make([]flatResourcePermission, 0)
	if err := sess.SQL(sql, args...).Find(&queryResults); err != nil {
		return nil, err
	}

	var result []accesscontrol.ResourcePermission
	users, teams, builtins := groupPermissionsByAssignment(queryResults)
	for _, p := range users {
		result = append(result, flatPermissionsToResourcePermissions(scope, p)...)
	}
	for _, p := range teams {
		result = append(result, flatPermissionsToResourcePermissions(scope, p)...)
	}
	for _, p := range builtins {
		result = append(result, flatPermissionsToResourcePermissions(scope, p)...)
	}

	return result, nil
}

func groupPermissionsByAssignment(permissions []flatResourcePermission) (map[int64][]flatResourcePermission, map[int64][]flatResourcePermission, map[string][]flatResourcePermission) {
	users := make(map[int64][]flatResourcePermission)
	teams := make(map[int64][]flatResourcePermission)
	builtins := make(map[string][]flatResourcePermission)

	for _, p := range permissions {
		if p.UserId != 0 {
			users[p.UserId] = append(users[p.UserId], p)
		} else if p.TeamId != 0 {
			teams[p.TeamId] = append(teams[p.TeamId], p)
		} else if p.BuiltInRole != "" {
			builtins[p.BuiltInRole] = append(builtins[p.BuiltInRole], p)
		}
	}

	return users, teams, builtins
}

func flatPermissionsToResourcePermissions(scope string, permissions []flatResourcePermission) []accesscontrol.ResourcePermission {
	var managed, inherited, provisioned []flatResourcePermission
	for _, p := range permissions {
		if p.IsManaged(scope) {
			managed = append(managed, p)
		} else if p.IsInherited(scope) {
			inherited = append(inherited, p)
		} else {
			provisioned = append(provisioned, p)
		}
	}

	var result []accesscontrol.ResourcePermission
	if g := flatPermissionsToResourcePermission(scope, managed); g != nil {
		result = append(result, *g)
	}
	if g := flatPermissionsToResourcePermission(scope, inherited); g != nil {
		result = append(result, *g)
	}
	if g := flatPermissionsToResourcePermission(scope, provisioned); g != nil {
		result = append(result, *g)
	}

	return result
}

func flatPermissionsToResourcePermission(scope string, permissions []flatResourcePermission) *accesscontrol.ResourcePermission {
	if len(permissions) == 0 {
		return nil
	}

	actions := make([]string, 0, len(permissions))
	for _, p := range permissions {
		actions = append(actions, p.Action)
	}

	first := permissions[0]
	return &accesscontrol.ResourcePermission{
		ID:               first.ID,
		RoleName:         first.RoleName,
		Actions:          actions,
		Scope:            first.Scope,
		UserId:           first.UserId,
		UserLogin:        first.UserLogin,
		UserEmail:        first.UserEmail,
		TeamId:           first.TeamId,
		TeamEmail:        first.TeamEmail,
		Team:             first.Team,
		BuiltInRole:      first.BuiltInRole,
		Created:          first.Created,
		Updated:          first.Updated,
		IsManaged:        first.IsManaged(scope),
		IsInherited:      first.IsInherited(scope),
		IsServiceAccount: first.IsServiceAccount,
	}
}

func (s *store) userAdder(sess *db.Session, orgID, userID int64) roleAdder {
	return func(roleID int64) error {
		if res, err := sess.Query("SELECT 1 FROM user_role WHERE org_id=? AND user_id=? AND role_id=?", orgID, userID, roleID); err != nil {
			return err
		} else if len(res) == 1 {
			return fmt.Errorf("role is already added to this user")
		}

		userRole := &accesscontrol.UserRole{
			OrgID:   orgID,
			UserID:  userID,
			RoleID:  roleID,
			Created: time.Now(),
		}

		_, err := sess.Insert(userRole)

		return err
	}
}

func (s *store) teamAdder(sess *db.Session, orgID, teamID int64) roleAdder {
	return func(roleID int64) error {
		if res, err := sess.Query("SELECT 1 FROM team_role WHERE org_id=? AND team_id=? AND role_id=?", orgID, teamID, roleID); err != nil {
			return err
		} else if len(res) == 1 {
			return fmt.Errorf("role is already added to this team")
		}

		teamRole := &accesscontrol.TeamRole{
			OrgID:   orgID,
			TeamID:  teamID,
			RoleID:  roleID,
			Created: time.Now(),
		}

		_, err := sess.Insert(teamRole)
		return err
	}
}

func (s *store) builtInRoleAdder(sess *db.Session, orgID int64, builtinRole string) roleAdder {
	return func(roleID int64) error {
		if res, err := sess.Query("SELECT 1 FROM builtin_role WHERE role_id=? AND role=? AND org_id=?", roleID, builtinRole, orgID); err != nil {
			return err
		} else if len(res) == 1 {
			return fmt.Errorf("built-in role already has the role granted")
		}

		_, err := sess.Table("builtin_role").Insert(accesscontrol.BuiltinRole{
			RoleID:  roleID,
			OrgID:   orgID,
			Role:    builtinRole,
			Updated: time.Now(),
			Created: time.Now(),
		})

		return err
	}
}

func (s *store) getOrCreateManagedRole(sess *db.Session, orgID int64, name string, add roleAdder) (*accesscontrol.Role, error) {
	role := accesscontrol.Role{OrgID: orgID, Name: name}
	has, err := sess.Where("org_id = ? AND name = ?", orgID, name).Get(&role)

	// If managed role does not exist, create it and add it to user/team/builtin
	if !has {
		uid, err := generateNewRoleUID(sess, orgID)
		if err != nil {
			return nil, err
		}

		role = accesscontrol.Role{
			OrgID:   orgID,
			Name:    name,
			UID:     uid,
			Created: time.Now(),
			Updated: time.Now(),
		}

		if _, err := sess.Insert(&role); err != nil {
			return nil, err
		}

		if err := add(role.ID); err != nil {
			return nil, err
		}
	}

	if err != nil {
		return nil, err
	}

	return &role, nil
}

func generateNewRoleUID(sess *db.Session, orgID int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()

		exists, err := sess.Where("org_id=? AND uid=?", orgID, uid).Get(&accesscontrol.Role{})
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", fmt.Errorf("failed to generate uid")
}

func (s *store) getPermissions(sess *db.Session, resource, resourceID, resourceAttribute string, roleID int64) ([]flatResourcePermission, error) {
	var result []flatResourcePermission
	rawSql := `
	SELECT
		p.*,
		ur.user_id AS user_id,
		u.login AS user_login,
		u.email AS user_email,
		tr.team_id AS team_id,
		t.name AS team,
		t.email AS team_email,
		r.name as role_name,
		br.role AS built_in_role
	FROM permission p
		INNER JOIN role r ON p.role_id = r.id
		LEFT JOIN team_role tr ON r.id = tr.role_id
		LEFT JOIN team t ON tr.team_id = t.id
		LEFT JOIN user_role ur ON r.id = ur.role_id
		LEFT JOIN ` + s.sql.GetDialect().Quote("user") + ` u ON ur.user_id = u.id
		LEFT JOIN builtin_role br ON r.id = br.role_id
	WHERE r.id = ? AND p.scope = ?
	`
	if err := sess.SQL(rawSql, roleID, accesscontrol.Scope(resource, resourceAttribute, resourceID)).Find(&result); err != nil {
		return nil, err
	}

	return result, nil
}

func (s *store) createPermissions(sess *db.Session, roleID int64, cmd SetResourcePermissionCommand, missingActions map[string]struct{}) error {
	permissions := make([]accesscontrol.Permission, 0, len(missingActions))

	resource := cmd.Resource
	resourceID := cmd.ResourceID
	resourceAttribute := cmd.ResourceAttribute
	permission := cmd.Permission
	/*
		Add ACTION SET of managed permissions to in-memory store
	*/
	if s.shouldStoreActionSet(resource, permission) {
		actionSetName := GetActionSetName(resource, permission)
		p := managedPermission(actionSetName, resource, resourceID, resourceAttribute)
		p.RoleID = roleID
		p.Created = time.Now()
		p.Updated = time.Now()
		p.Kind, p.Attribute, p.Identifier = p.SplitScope()
		permissions = append(permissions, p)
	}

	// If there are no missing actions for the resource (in case of access level downgrade or resource removal), we don't need to insert any actions
	// we still want to add the action set (when permission != "")
	if len(missingActions) == 0 && !s.shouldStoreActionSet(resource, permission) {
		return nil
	}

	// if we have actionset feature enabled and are only working with action sets
	// skip adding the missing actions to the permissions table
	if !(s.shouldStoreActionSet(resource, permission) && s.cfg.RBAC.OnlyStoreAccessActionSets) {
		for action := range missingActions {
			p := managedPermission(action, resource, resourceID, resourceAttribute)
			p.RoleID = roleID
			p.Created = time.Now()
			p.Updated = time.Now()
			p.Kind, p.Attribute, p.Identifier = p.SplitScope()
			permissions = append(permissions, p)
		}
	}

	if _, err := sess.InsertMulti(&permissions); err != nil {
		return err
	}
	return nil
}

func (s *store) shouldStoreActionSet(resource, permission string) bool {
	if permission == "" {
		return false
	}
	actionSetName := GetActionSetName(resource, permission)
	return isFolderOrDashboardAction(actionSetName)
}

func deletePermissions(sess *db.Session, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}

	rawSQL := "DELETE FROM permission WHERE id IN(?" + strings.Repeat(",?", len(ids)-1) + ")"
	args := make([]any, 0, len(ids)+1)
	args = append(args, rawSQL)
	for _, id := range ids {
		args = append(args, id)
	}

	_, err := sess.Exec(args...)
	if err != nil {
		return err
	}

	return nil
}

func managedPermission(action, resource string, resourceID, resourceAttribute string) accesscontrol.Permission {
	return accesscontrol.Permission{
		Action: action,
		Scope:  accesscontrol.Scope(resource, resourceAttribute, resourceID),
	}
}

// InMemoryActionSets is an in-memory implementation of the ActionSetStore.
type InMemoryActionSets struct {
	features           featuremgmt.FeatureToggles
	log                log.Logger
	actionSetToActions map[string][]string
	actionToActionSets map[string][]string
}

func NewInMemoryActionSetStore(features featuremgmt.FeatureToggles) *InMemoryActionSets {
	return &InMemoryActionSets{
		actionSetToActions: make(map[string][]string),
		actionToActionSets: make(map[string][]string),
		log:                log.New("resourcepermissions.actionsets"),
		features:           features,
	}
}

// ResolveActionPrefix returns all action sets that include at least one action with the specified prefix
func (s *InMemoryActionSets) ResolveActionPrefix(prefix string) []string {
	if prefix == "" {
		return []string{}
	}

	sets := make([]string, 0, len(s.actionSetToActions))

	for set, actions := range s.actionSetToActions {
		for _, action := range actions {
			if strings.HasPrefix(action, prefix) {
				sets = append(sets, set)
				break
			}
		}
	}

	return sets
}

func (s *InMemoryActionSets) ResolveAction(action string) []string {
	return s.actionToActionSets[action]
}

func (s *InMemoryActionSets) ResolveActionSet(actionSet string) []string {
	return s.actionSetToActions[actionSet]
}

func (s *InMemoryActionSets) ExpandActionSetsWithFilter(permissions []accesscontrol.Permission, actionMatcher func(action string) bool) []accesscontrol.Permission {
	var expandedPermissions []accesscontrol.Permission
	for _, permission := range permissions {
		resolvedActions := s.ResolveActionSet(permission.Action)
		if len(resolvedActions) == 0 {
			expandedPermissions = append(expandedPermissions, permission)
			continue
		}
		for _, action := range resolvedActions {
			if !actionMatcher(action) {
				continue
			}
			permission.Action = action
			expandedPermissions = append(expandedPermissions, permission)
		}
	}
	return expandedPermissions
}

func (s *InMemoryActionSets) StoreActionSet(name string, actions []string) {
	s.actionSetToActions[name] = append(s.actionSetToActions[name], actions...)

	for _, action := range actions {
		if _, ok := s.actionToActionSets[action]; !ok {
			s.actionToActionSets[action] = []string{}
		}
		s.actionToActionSets[action] = append(s.actionToActionSets[action], name)
	}
	s.log.Debug("stored action set", "action set name", name)
}

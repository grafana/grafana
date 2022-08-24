package resourcepermissions

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/util"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
)

func NewStore(sql *sqlstore.SQLStore) *store {
	return &store{sql}
}

type store struct {
	sql *sqlstore.SQLStore
}

type flatResourcePermission struct {
	ID          int64 `xorm:"id"`
	RoleName    string
	Action      string
	Scope       string
	UserId      int64
	UserLogin   string
	UserEmail   string
	TeamId      int64
	TeamEmail   string
	Team        string
	BuiltInRole string
	Created     time.Time
	Updated     time.Time
}

func (p *flatResourcePermission) IsManaged(scope string) bool {
	return strings.HasPrefix(p.RoleName, accesscontrol.ManagedRolePrefix) && !p.IsInherited(scope)
}

func (p *flatResourcePermission) IsInherited(scope string) bool {
	return !strings.HasPrefix(p.Scope, strings.Split(strings.ReplaceAll(scope, "*", ""), ":")[0])
}

func (s *store) SetUserResourcePermission(
	ctx context.Context, orgID int64, usr accesscontrol.User,
	cmd SetResourcePermissionCommand,
	hook UserResourceHookFunc,
) (*accesscontrol.ResourcePermission, error) {
	if usr.ID == 0 {
		return nil, user.ErrUserNotFound
	}

	var err error
	var permission *accesscontrol.ResourcePermission
	err = s.sql.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		permission, err = s.setUserResourcePermission(sess, orgID, usr, cmd, hook)
		return err
	})

	return permission, err
}
func (s *store) setUserResourcePermission(
	sess *sqlstore.DBSession, orgID int64, user accesscontrol.User,
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
	if teamID == 0 {
		return nil, models.ErrTeamNotFound
	}

	var err error
	var permission *accesscontrol.ResourcePermission

	err = s.sql.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		permission, err = s.setTeamResourcePermission(sess, orgID, teamID, cmd, hook)
		return err
	})

	return permission, err
}

func (s *store) setTeamResourcePermission(
	sess *sqlstore.DBSession, orgID, teamID int64,
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
	if !org.RoleType(builtInRole).IsValid() || builtInRole == accesscontrol.RoleGrafanaAdmin {
		return nil, fmt.Errorf("invalid role: %s", builtInRole)
	}

	var err error
	var permission *accesscontrol.ResourcePermission

	err = s.sql.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		permission, err = s.setBuiltInResourcePermission(sess, orgID, builtInRole, cmd, hook)
		return err
	})

	if err != nil {
		return nil, err
	}

	return permission, nil
}

func (s *store) setBuiltInResourcePermission(
	sess *sqlstore.DBSession, orgID int64, builtInRole string,
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
	var err error
	var permissions []accesscontrol.ResourcePermission

	err = s.sql.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
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
	sess *sqlstore.DBSession, orgID int64, roleName string, adder roleAdder, cmd SetResourcePermissionCommand,
) (*accesscontrol.ResourcePermission, error) {
	role, err := s.getOrCreateManagedRole(sess, orgID, roleName, adder)
	if err != nil {
		return nil, err
	}

	rawSQL := `
	SELECT
		p.*
	FROM permission as p
		INNER JOIN role r on r.id = p.role_id
	WHERE r.id = ?
		AND p.scope = ?
	`

	var current []accesscontrol.Permission
	scope := accesscontrol.Scope(cmd.Resource, cmd.ResourceAttribute, cmd.ResourceID)
	if err := sess.SQL(rawSQL, role.ID, scope).Find(&current); err != nil {
		return nil, err
	}

	missing := make(map[string]struct{}, len(cmd.Actions))
	for _, a := range cmd.Actions {
		missing[a] = struct{}{}
	}

	var keep []int64
	var remove []int64
	for _, p := range current {
		if _, ok := missing[p.Action]; ok {
			keep = append(keep, p.ID)
			delete(missing, p.Action)
		} else if !ok {
			remove = append(remove, p.ID)
		}
	}

	if err := deletePermissions(sess, remove); err != nil {
		return nil, err
	}

	for action := range missing {
		id, err := s.createResourcePermission(sess, role.ID, action, cmd.Resource, cmd.ResourceID, cmd.ResourceAttribute)
		if err != nil {
			return nil, err
		}
		keep = append(keep, id)
	}

	permissions, err := s.getResourcePermissionsByIds(sess, cmd.Resource, cmd.ResourceID, cmd.ResourceAttribute, keep)
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
	var result []accesscontrol.ResourcePermission

	err := s.sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var err error
		result, err = s.getResourcePermissions(sess, orgID, query)
		return err
	})

	return result, err
}

func (s *store) createResourcePermission(sess *sqlstore.DBSession, roleID int64, action, resource, resourceID, resourceAttribute string) (int64, error) {
	permission := managedPermission(action, resource, resourceID, resourceAttribute)
	permission.RoleID = roleID
	permission.Created = time.Now()
	permission.Updated = time.Now()

	if _, err := sess.Insert(&permission); err != nil {
		return 0, err
	}
	return permission.ID, nil
}

func (s *store) getResourcePermissions(sess *sqlstore.DBSession, orgID int64, query GetResourcePermissionsQuery) ([]accesscontrol.ResourcePermission, error) {
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
		u.email AS user_email,
		0 AS team_id,
		'' AS team,
		'' AS team_email,
		'' AS built_in_role
	`

	teamSelect := rawSelect + `
		0 AS user_id,
		'' AS user_login,
		'' AS user_email,
		tr.team_id AS team_id,
		t.name AS team,
		t.email AS team_email,
		'' AS built_in_role
	`

	builtinSelect := rawSelect + `
		0 AS user_id,
		'' AS user_login,
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
		INNER JOIN ` + s.sql.Dialect.Quote("user") + ` u ON ur.user_id = u.id
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

	args := []interface{}{
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

	userFilter, err := accesscontrol.Filter(query.User, "u.id", "users:id:", accesscontrol.ActionOrgUsersRead)
	if err != nil {
		return nil, err
	}
	user := userSelect + userFrom + where + " AND " + userFilter.Where
	args = append(args, userFilter.Args...)

	teamFilter, err := accesscontrol.Filter(query.User, "t.id", "teams:id:", accesscontrol.ActionTeamsRead)
	if err != nil {
		return nil, err
	}

	team := teamSelect + teamFrom + where + " AND " + teamFilter.Where
	args = append(args, args[:initialLength]...)
	args = append(args, teamFilter.Args...)

	builtin := builtinSelect + builtinFrom + where
	args = append(args, args[:initialLength]...)

	sql := user + " UNION " + team + " UNION " + builtin
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
	var managed, provisioned []flatResourcePermission
	for _, p := range permissions {
		if p.IsManaged(scope) {
			managed = append(managed, p)
		} else {
			provisioned = append(provisioned, p)
		}
	}

	var result []accesscontrol.ResourcePermission
	if g := flatPermissionsToResourcePermission(scope, managed); g != nil {
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
		ID:          first.ID,
		RoleName:    first.RoleName,
		Actions:     actions,
		Scope:       first.Scope,
		UserId:      first.UserId,
		UserLogin:   first.UserLogin,
		UserEmail:   first.UserEmail,
		TeamId:      first.TeamId,
		TeamEmail:   first.TeamEmail,
		Team:        first.Team,
		BuiltInRole: first.BuiltInRole,
		Created:     first.Created,
		Updated:     first.Updated,
		IsManaged:   first.IsManaged(scope),
		IsInherited: first.IsInherited(scope),
	}
}

func (s *store) userAdder(sess *sqlstore.DBSession, orgID, userID int64) roleAdder {
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

func (s *store) teamAdder(sess *sqlstore.DBSession, orgID, teamID int64) roleAdder {
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

func (s *store) builtInRoleAdder(sess *sqlstore.DBSession, orgID int64, builtinRole string) roleAdder {
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

func (s *store) getOrCreateManagedRole(sess *sqlstore.DBSession, orgID int64, name string, add roleAdder) (*accesscontrol.Role, error) {
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

func (s *store) getResourcePermissionsByIds(sess *sqlstore.DBSession, resource, resourceID, resourceAttribute string, ids []int64) ([]flatResourcePermission, error) {
	var result []flatResourcePermission
	if len(ids) == 0 {
		return result, nil
	}
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
		LEFT JOIN ` + s.sql.Dialect.Quote("user") + ` u ON ur.user_id = u.id
		LEFT JOIN builtin_role br ON r.id = br.role_id
	WHERE p.id IN (?` + strings.Repeat(",?", len(ids)-1) + `)
	`

	args := make([]interface{}, 0, len(ids)+1)
	for _, id := range ids {
		args = append(args, id)
	}

	if err := sess.SQL(rawSql, args...).Find(&result); err != nil {
		return nil, err
	}

	return result, nil
}

func generateNewRoleUID(sess *sqlstore.DBSession, orgID int64) (string, error) {
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

func deletePermissions(sess *sqlstore.DBSession, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}

	rawSQL := "DELETE FROM permission WHERE id IN(?" + strings.Repeat(",?", len(ids)-1) + ")"
	args := make([]interface{}, 0, len(ids)+1)
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

package database

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type flatResourcePermission struct {
	ID          int64  `xorm:"id"`
	ResourceID  string `xorm:"resource_id"`
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

func (p *flatResourcePermission) Managed() bool {
	return strings.HasPrefix(p.RoleName, "managed:")
}

func (s *AccessControlStore) SetUserResourcePermission(ctx context.Context, orgID, userID int64, cmd accesscontrol.SetResourcePermissionCommand) (*accesscontrol.ResourcePermission, error) {
	if userID == 0 {
		return nil, models.ErrUserNotFound
	}

	var err error
	var permission *accesscontrol.ResourcePermission
	err = s.sql.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		permission, err = s.setResourcePermission(sess, orgID, managedUserRoleName(userID), s.userAdder(sess, orgID, userID), cmd)
		if err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	return permission, nil
}

func (s *AccessControlStore) SetTeamResourcePermission(ctx context.Context, orgID, teamID int64, cmd accesscontrol.SetResourcePermissionCommand) (*accesscontrol.ResourcePermission, error) {
	if teamID == 0 {
		return nil, models.ErrTeamNotFound
	}

	var err error
	var permission *accesscontrol.ResourcePermission

	err = s.sql.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		permission, err = s.setResourcePermission(sess, orgID, managedTeamRoleName(teamID), s.teamAdder(sess, orgID, teamID), cmd)
		if err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	return permission, nil
}

func (s *AccessControlStore) SetBuiltInResourcePermission(ctx context.Context, orgID int64, builtInRole string, cmd accesscontrol.SetResourcePermissionCommand) (*accesscontrol.ResourcePermission, error) {
	if !models.RoleType(builtInRole).IsValid() || builtInRole == accesscontrol.RoleGrafanaAdmin {
		return nil, fmt.Errorf("invalid role: %s", builtInRole)
	}

	var err error
	var permission *accesscontrol.ResourcePermission

	err = s.sql.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		permission, err = s.setResourcePermission(sess, orgID, managedBuiltInRoleName(builtInRole), s.builtInRoleAdder(sess, orgID, builtInRole), cmd)
		return err
	})

	if err != nil {
		return nil, err
	}

	return permission, nil
}

type roleAdder func(roleID int64) error

func (s *AccessControlStore) setResourcePermission(
	sess *sqlstore.DBSession, orgID int64, roleName string, adder roleAdder, cmd accesscontrol.SetResourcePermissionCommand,
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
	if err := sess.SQL(rawSQL, role.ID, accesscontrol.GetResourceScope(cmd.Resource, cmd.ResourceID)).Find(&current); err != nil {
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

	var permissions []flatResourcePermission

	for action := range missing {
		p, err := createResourcePermission(sess, role.ID, action, cmd.Resource, cmd.ResourceID)
		if err != nil {
			return nil, err
		}
		permissions = append(permissions, *p)
	}

	keptPermissions, err := getResourcePermissions(sess, cmd.ResourceID, keep)
	if err != nil {
		return nil, err
	}

	permission := flatPermissionsToResourcePermission(append(permissions, keptPermissions...))
	if permission == nil {
		return &accesscontrol.ResourcePermission{}, nil
	}

	return permission, nil
}

func (s *AccessControlStore) GetResourcesPermissions(ctx context.Context, orgID int64, query accesscontrol.GetResourcesPermissionsQuery) ([]accesscontrol.ResourcePermission, error) {
	var result []accesscontrol.ResourcePermission

	err := s.sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var err error
		result, err = getResourcesPermissions(sess, orgID, query)
		return err
	})

	return result, err
}

func createResourcePermission(sess *sqlstore.DBSession, roleID int64, action, resource string, resourceID string) (*flatResourcePermission, error) {
	permission := managedPermission(action, resource, resourceID)
	permission.RoleID = roleID
	permission.Created = time.Now()
	permission.Updated = time.Now()

	if _, err := sess.Insert(&permission); err != nil {
		return nil, err
	}

	rawSql := `
	SELECT
		p.*,
		? AS resource_id,
		ur.user_id AS user_id,
		u.login AS user_login,
		u.email AS user_email,
		tr.team_id AS team_id,
		t.name AS team,
		t.email AS team_email,
		r.name as role_name
	FROM permission p
		LEFT JOIN role r ON p.role_id = r.id
		LEFT JOIN team_role tr ON r.id = tr.role_id
		LEFT JOIN team t ON tr.team_id = t.id
		LEFT JOIN user_role ur ON r.id = ur.role_id
		LEFT JOIN user u ON ur.user_id = u.id
	WHERE p.id = ?
	`

	p := &flatResourcePermission{}
	if _, err := sess.SQL(rawSql, resourceID, permission.ID).Get(p); err != nil {
		return nil, err
	}

	return p, nil
}

func getResourcesPermissions(sess *sqlstore.DBSession, orgID int64, query accesscontrol.GetResourcesPermissionsQuery) ([]accesscontrol.ResourcePermission, error) {
	if len(query.Actions) == 0 {
		return nil, nil
	}

	if len(query.ResourceIDs) == 0 {
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
		INNER JOIN user u ON ur.user_id = u.id
	`
	teamFrom := rawFrom + `
		INNER JOIN team_role tr ON r.id = tr.role_id AND (tr.org_id = 0 OR tr.org_id = ?)
		INNER JOIN team t ON tr.team_id = t.id
	`

	builtinFrom := rawFrom + `
		INNER JOIN builtin_role br ON r.id = br.role_id AND (br.org_id = 0 OR br.org_id = ?)
	`
	where := `
	WHERE (r.org_id = ? OR r.org_id = 0)
		AND (p.scope = '*' OR p.scope = ? OR p.scope = ? OR p.scope IN (?` + strings.Repeat(",?", len(query.ResourceIDs)-1) + `))
		AND p.action IN (?` + strings.Repeat(",?", len(query.Actions)-1) + `)
	`

	if query.OnlyManaged {
		where += `AND r.name LIKE 'managed:%'`
	}

	args := []interface{}{
		orgID,
		orgID,
		accesscontrol.GetResourceAllScope(query.Resource),
		accesscontrol.GetResourceAllIDScope(query.Resource),
	}

	for _, id := range query.ResourceIDs {
		args = append(args, accesscontrol.GetResourceScope(query.Resource, id))
	}

	for _, a := range query.Actions {
		args = append(args, a)
	}

	// Need args x3 due to union
	initialLength := len(args)
	args = append(args, args[:initialLength]...)
	args = append(args, args[:initialLength]...)

	user := userSelect + userFrom + where
	team := teamSelect + teamFrom + where
	builtin := builtinSelect + builtinFrom + where
	sql := user + "UNION" + team + "UNION" + builtin

	queryResults := make([]flatResourcePermission, 0)
	if err := sess.SQL(sql, args...).Find(&queryResults); err != nil {
		return nil, err
	}

	scopeAll := accesscontrol.GetResourceAllScope(query.Resource)
	scopeAllIDs := accesscontrol.GetResourceAllIDScope(query.Resource)

	byResource := make(map[string][]flatResourcePermission)
	// Add resourceIds and generate permissions for `*`, `resource:*` and `resource:id:*`
	for _, id := range query.ResourceIDs {
		scope := accesscontrol.GetResourceScope(query.Resource, id)
		for _, p := range queryResults {
			if p.Scope == scope || p.Scope == scopeAll || p.Scope == scopeAllIDs || p.Scope == "*" {
				p.ResourceID = id
				byResource[p.ResourceID] = append(byResource[p.ResourceID], p)
			}
		}
	}

	var result []accesscontrol.ResourcePermission
	for _, permissions := range byResource {
		users, teams, builtins := groupPermissionsByAssignment(permissions)
		for _, p := range users {
			result = append(result, flatPermissionsToResourcePermissions(p)...)
		}
		for _, p := range teams {
			result = append(result, flatPermissionsToResourcePermissions(p)...)
		}
		for _, p := range builtins {
			result = append(result, flatPermissionsToResourcePermissions(p)...)
		}
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

func flatPermissionsToResourcePermissions(permissions []flatResourcePermission) []accesscontrol.ResourcePermission {
	var managed, provisioned []flatResourcePermission
	for _, p := range permissions {
		if p.Managed() {
			managed = append(managed, p)
		} else {
			provisioned = append(provisioned, p)
		}
	}

	var result []accesscontrol.ResourcePermission
	if g := flatPermissionsToResourcePermission(managed); g != nil {
		result = append(result, *g)
	}
	if g := flatPermissionsToResourcePermission(provisioned); g != nil {
		result = append(result, *g)
	}

	return result
}

func flatPermissionsToResourcePermission(permissions []flatResourcePermission) *accesscontrol.ResourcePermission {
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
		ResourceID:  first.ResourceID,
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
	}
}

func (s *AccessControlStore) userAdder(sess *sqlstore.DBSession, orgID, userID int64) roleAdder {
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

func (s *AccessControlStore) teamAdder(sess *sqlstore.DBSession, orgID, teamID int64) roleAdder {
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

func (s *AccessControlStore) builtInRoleAdder(sess *sqlstore.DBSession, orgID int64, builtinRole string) roleAdder {
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

func (s *AccessControlStore) getOrCreateManagedRole(sess *sqlstore.DBSession, orgID int64, name string, add roleAdder) (*accesscontrol.Role, error) {
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

func getResourcePermissions(sess *sqlstore.DBSession, resourceID string, ids []int64) ([]flatResourcePermission, error) {
	var result []flatResourcePermission
	if len(ids) == 0 {
		return result, nil
	}

	rawSql := `
	SELECT
		p.*,
		? AS resource_id,
		ur.user_id AS user_id,
		u.login AS user_login,
		u.email AS user_email,
		tr.team_id AS team_id,
		t.name AS team,
		t.email AS team_email,
		r.name as role_name
	FROM permission p
		INNER JOIN role r ON p.role_id = r.id
		LEFT JOIN team_role tr ON r.id = tr.role_id
		LEFT JOIN team t ON tr.team_id = t.id
		LEFT JOIN user_role ur ON r.id = ur.role_id
		LEFT JOIN user u ON ur.user_id = u.id
	WHERE p.id IN (?` + strings.Repeat(",?", len(ids)-1) + `)
	`

	args := make([]interface{}, 0, len(ids)+1)
	args = append(args, resourceID)
	for _, id := range ids {
		args = append(args, id)
	}

	if err := sess.SQL(rawSql, args...).Find(&result); err != nil {
		return nil, err
	}

	return result, nil
}

func managedPermission(action, resource string, resourceID string) accesscontrol.Permission {
	return accesscontrol.Permission{
		Action: action,
		Scope:  accesscontrol.GetResourceScope(resource, resourceID),
	}
}

func managedUserRoleName(userID int64) string {
	return fmt.Sprintf("managed:users:%d:permissions", userID)
}

func managedTeamRoleName(teamID int64) string {
	return fmt.Sprintf("managed:teams:%d:permissions", teamID)
}

func managedBuiltInRoleName(builtInRole string) string {
	return fmt.Sprintf("managed:builtins:%s:permissions", strings.ToLower(builtInRole))
}

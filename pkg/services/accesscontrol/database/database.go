package database

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func ProvideService(sql db.DB) *AccessControlStore {
	return &AccessControlStore{sql}
}

type AccessControlStore struct {
	sql db.DB
}

func (s *AccessControlStore) GetUserPermissions(ctx context.Context, query accesscontrol.GetUserPermissionsQuery) ([]accesscontrol.Permission, error) {
	result := make([]accesscontrol.Permission, 0)
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		if query.UserID == 0 && len(query.TeamIDs) == 0 && len(query.Roles) == 0 {
			// no permission to fetch
			return nil
		}

		filter, params := accesscontrol.UserRolesFilter(query.OrgID, query.UserID, query.TeamIDs, query.Roles)

		q := `
		SELECT
			permission.action,
			permission.scope
			FROM permission
			INNER JOIN role ON role.id = permission.role_id
		` + filter

		if len(query.RolePrefixes) > 0 {
			q += " WHERE ( " + strings.Repeat("role.name LIKE ? OR ", len(query.RolePrefixes))
			q = q[:len(q)-4] + " )" // remove last " OR "
			for i := range query.RolePrefixes {
				params = append(params, query.RolePrefixes[i]+"%")
			}
		}

		if err := sess.SQL(q, params...).Find(&result); err != nil {
			return err
		}

		return nil
	})

	return result, err
}

// SearchUsersPermissions returns the list of user permissions indexed by UserID
func (s *AccessControlStore) SearchUsersPermissions(ctx context.Context, orgID int64, options accesscontrol.SearchOptions) (map[int64][]accesscontrol.Permission, error) {
	type UserRBACPermission struct {
		UserID int64  `xorm:"user_id"`
		Action string `xorm:"action"`
		Scope  string `xorm:"scope"`
	}
	dbPerms := make([]UserRBACPermission, 0)
	if err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		// Find permissions
		q := `
		SELECT
			user_id,
			action,
			scope
		FROM (
			SELECT ur.user_id, ur.org_id, p.action, p.scope
				FROM permission AS p
				INNER JOIN user_role AS ur on ur.role_id = p.role_id
			UNION ALL
				SELECT tm.user_id, tr.org_id, p.action, p.scope
					FROM permission AS p
					INNER JOIN team_role AS tr ON tr.role_id = p.role_id
					INNER JOIN team_member AS tm ON tm.team_id = tr.team_id
			UNION ALL
				SELECT ou.user_id, br.org_id, p.action, p.scope
					FROM permission AS p
					INNER JOIN builtin_role AS br ON br.role_id = p.role_id
					INNER JOIN org_user AS ou ON ou.role = br.role
			UNION ALL
				SELECT sa.user_id, br.org_id, p.action, p.scope
					FROM permission AS p
					INNER JOIN builtin_role AS br ON br.role_id = p.role_id
					INNER JOIN (
						SELECT u.id AS user_id
						FROM ` + s.sql.GetDialect().Quote("user") + ` AS u WHERE u.is_admin
					) AS sa ON 1 = 1
					WHERE br.role = ?
		) AS up
		WHERE (org_id = ? OR org_id = ?)
		`

		params := []interface{}{accesscontrol.RoleGrafanaAdmin, accesscontrol.GlobalOrgID, orgID}

		if options.ActionPrefix != "" {
			q += ` AND action LIKE ?`
			params = append(params, options.ActionPrefix+"%")
		}
		if options.Action != "" {
			q += ` AND action = ?`
			params = append(params, options.Action)
		}
		if options.Scope != "" {
			q += ` AND scope = ?`
			params = append(params, options.Scope)
		}

		if options.UserID != 0 {
			q += ` AND user_id = ?`
			params = append(params, options.UserID)
		}

		return sess.SQL(q, params...).
			Find(&dbPerms)
	}); err != nil {
		return nil, err
	}

	mapped := map[int64][]accesscontrol.Permission{}
	for i := range dbPerms {
		mapped[dbPerms[i].UserID] = append(mapped[dbPerms[i].UserID], accesscontrol.Permission{Action: dbPerms[i].Action, Scope: dbPerms[i].Scope})
	}

	return mapped, nil
}

// GetUsersBasicRoles returns the list of user basic roles (Admin, Editor, Viewer, Grafana Admin) indexed by UserID
func (s *AccessControlStore) GetUsersBasicRoles(ctx context.Context, userFilter []int64, orgID int64) (map[int64][]string, error) {
	type UserOrgRole struct {
		UserID  int64  `xorm:"id"`
		OrgRole string `xorm:"role"`
		IsAdmin bool   `xorm:"is_admin"`
	}
	dbRoles := make([]UserOrgRole, 0)
	if err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		// Find roles
		q := `
		SELECT u.id, ou.role, u.is_admin
		FROM ` + s.sql.GetDialect().Quote("user") + ` AS u
		LEFT JOIN org_user AS ou ON u.id = ou.user_id
		WHERE (u.is_admin OR ou.org_id = ?)
		`
		params := []interface{}{orgID}
		if len(userFilter) > 0 {
			q += "AND u.id IN (?" + strings.Repeat(",?", len(userFilter)-1) + ")"
			for _, u := range userFilter {
				params = append(params, u)
			}
		}

		return sess.SQL(q, params...).Find(&dbRoles)
	}); err != nil {
		return nil, err
	}

	roles := map[int64][]string{}
	for i := range dbRoles {
		if dbRoles[i].OrgRole != "" {
			roles[dbRoles[i].UserID] = []string{dbRoles[i].OrgRole}
		}
		if dbRoles[i].IsAdmin {
			roles[dbRoles[i].UserID] = append(roles[dbRoles[i].UserID], accesscontrol.RoleGrafanaAdmin)
		}
	}
	return roles, nil
}

func (s *AccessControlStore) DeleteUserPermissions(ctx context.Context, orgID, userID int64) error {
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		roleDeleteQuery := "DELETE FROM user_role WHERE user_id = ?"
		roleDeleteParams := []interface{}{roleDeleteQuery, userID}
		if orgID != accesscontrol.GlobalOrgID {
			roleDeleteQuery += " AND org_id = ?"
			roleDeleteParams = []interface{}{roleDeleteQuery, userID, orgID}
		}

		// Delete user role assignments
		if _, err := sess.Exec(roleDeleteParams...); err != nil {
			return err
		}

		// only delete scopes to user if all permissions is removed (i.e. user is removed)
		if orgID == accesscontrol.GlobalOrgID {
			// Delete permissions that are scoped to user
			if _, err := sess.Exec("DELETE FROM permission WHERE scope = ?", accesscontrol.Scope("users", "id", strconv.FormatInt(userID, 10))); err != nil {
				return err
			}
		}

		roleQuery := "SELECT id FROM role WHERE name = ?"
		roleParams := []interface{}{accesscontrol.ManagedUserRoleName(userID)}
		if orgID != accesscontrol.GlobalOrgID {
			roleQuery += " AND org_id = ?"
			roleParams = []interface{}{accesscontrol.ManagedUserRoleName(userID), orgID}
		}

		var roleIDs []int64
		if err := sess.SQL(roleQuery, roleParams...).Find(&roleIDs); err != nil {
			return err
		}

		if len(roleIDs) == 0 {
			return nil
		}

		permissionDeleteQuery := "DELETE FROM permission WHERE role_id IN(? " + strings.Repeat(",?", len(roleIDs)-1) + ")"
		permissionDeleteParams := make([]interface{}, 0, len(roleIDs)+1)
		permissionDeleteParams = append(permissionDeleteParams, permissionDeleteQuery)
		for _, id := range roleIDs {
			permissionDeleteParams = append(permissionDeleteParams, id)
		}

		// Delete managed user permissions
		if _, err := sess.Exec(permissionDeleteParams...); err != nil {
			return err
		}

		managedRoleDeleteQuery := "DELETE FROM role WHERE id IN(? " + strings.Repeat(",?", len(roleIDs)-1) + ")"
		managedRoleDeleteParams := []interface{}{managedRoleDeleteQuery}
		for _, id := range roleIDs {
			managedRoleDeleteParams = append(managedRoleDeleteParams, id)
		}
		// Delete managed user roles
		if _, err := sess.Exec(managedRoleDeleteParams...); err != nil {
			return err
		}

		return nil
	})
	return err
}

func (s *AccessControlStore) SaveExternalServiceRole(ctx context.Context, cmd accesscontrol.SaveExternalServiceRoleCommand) error {
	role, assignment := genExternalServiceRoleAndAssignment(cmd)

	return s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		// Create or update the role
		existingRole, errSaveRole := s.saveRole(ctx, sess, &role)
		if errSaveRole != nil {
			return errSaveRole
		}
		// Update permissions
		errSavePerm := s.savePermissions(ctx, sess, existingRole, cmd.Permissions)
		if errSavePerm != nil {
			return errSavePerm
		}
		// Assing role to service account
		assignment.RoleID = existingRole.ID
		errSaveAssign := s.saveUserAssignment(ctx, sess, assignment)
		if errSaveAssign != nil {
			return errSaveAssign
		}

		return nil
	})
}

func genExternalServiceRoleAndAssignment(cmd accesscontrol.SaveExternalServiceRoleCommand) (accesscontrol.Role, accesscontrol.UserRole) {
	role := accesscontrol.Role{
		OrgID:       cmd.OrgID,
		Version:     1,
		Name:        fmt.Sprintf("%s%s:permissions", accesscontrol.ExternalServiceRolePrefix, cmd.ExternalServiceID),
		UID:         fmt.Sprintf("%s%s_permissions", accesscontrol.ExternalServiceRoleUIDPrefix, cmd.ExternalServiceID),
		DisplayName: fmt.Sprintf("External Service %s Permissions", cmd.ExternalServiceID),
		Description: fmt.Sprintf("External Service %s permissions", cmd.ExternalServiceID),
		Hidden:      true,
		Created:     time.Now(),
		Updated:     time.Now(),
	}
	if cmd.Global {
		role.OrgID = accesscontrol.GlobalOrgID
	}

	assignment := accesscontrol.UserRole{
		OrgID:   cmd.OrgID,
		UserID:  cmd.ServiceAccountID,
		Created: time.Now(),
	}
	if cmd.Global {
		assignment.OrgID = accesscontrol.GlobalOrgID
	}
	return role, assignment
}

func getRoleByUID(ctx context.Context, sess *db.Session, uid string) (*accesscontrol.Role, error) {
	var role accesscontrol.Role
	has, err := sess.Where("uid = ?", uid).Get(&role)
	if err != nil {
		return nil, err
	}
	if !has {
		return nil, accesscontrol.ErrRoleNotFound
	}
	return &role, nil
}

func alreadyAssigned(ctx context.Context, sess *db.Session, roleID, saID int64) (bool, error) {
	var assignement accesscontrol.UserRole
	has, err := sess.Where("role_id = ? AND user_id = ?", roleID, saID).Get(&assignement)
	if err != nil {
		return false, err
	}
	return has, nil
}

func getRolePermissions(ctx context.Context, sess *db.Session, id int64) ([]accesscontrol.Permission, error) {
	var permissions []accesscontrol.Permission
	err := sess.Where("role_id = ?", id).Find(&permissions)
	if err != nil {
		return nil, err
	}
	return permissions, nil
}

func permissionDiff(previous, new []accesscontrol.Permission) (added, removed []accesscontrol.Permission) {
	type key struct{ Action, Scope string }
	prevMap := map[key]int64{}
	for i := range previous {
		prevMap[key{previous[i].Action, previous[i].Scope}] = previous[i].ID
	}
	newMap := map[key]int64{}
	for i := range new {
		newMap[key{new[i].Action, new[i].Scope}] = 0
	}
	for i := range new {
		key := key{new[i].Action, new[i].Scope}
		if _, already := prevMap[key]; !already {
			added = append(added, new[i])
		} else {
			delete(prevMap, key)
		}
	}

	for p, id := range prevMap {
		removed = append(removed, accesscontrol.Permission{ID: id, Action: p.Action, Scope: p.Scope})
	}

	return added, removed
}

func (*AccessControlStore) saveRole(ctx context.Context, sess *db.Session, role *accesscontrol.Role) (*accesscontrol.Role, error) {
	existingRole, err := getRoleByUID(ctx, sess, role.UID)
	if err != nil && !errors.Is(err, accesscontrol.ErrRoleNotFound) {
		return nil, err
	}

	if existingRole == nil {
		if _, err := sess.Insert(role); err != nil {
			return nil, err
		}
	} else {
		role.ID = existingRole.ID
		if _, err := sess.Where("id = ?", existingRole.ID).MustCols("org_id").Update(role); err != nil {
			return nil, err
		}
	}
	return getRoleByUID(ctx, sess, role.UID)
}

func (*AccessControlStore) savePermissions(ctx context.Context, sess *db.Session, role *accesscontrol.Role, permissions []accesscontrol.Permission) error {
	now := time.Now()
	storedPermissions, err := getRolePermissions(ctx, sess, role.ID)
	if err != nil {
		return err
	}
	added, removed := permissionDiff(storedPermissions, permissions)
	if len(added) > 0 {
		for i := range added {
			added[i].RoleID = role.ID
			added[i].Created = now
			added[i].Updated = now
		}
		if _, err := sess.Insert(&added); err != nil {
			return err
		}
	}
	if len(removed) > 0 {
		ids := make([]int64, len(removed))
		for i := range removed {
			ids[i] = removed[i].ID
		}
		count, err := sess.In("id", ids).Delete(&accesscontrol.Permission{})
		if err != nil {
			return err
		}
		if count != int64(len(removed)) {
			return fmt.Errorf("failed to delete permissions that have been removed from role")
		}
	}
	return nil
}

func (*AccessControlStore) saveUserAssignment(ctx context.Context, sess *db.Session, assignment accesscontrol.UserRole) error {
	has, err := alreadyAssigned(ctx, sess, assignment.RoleID, assignment.UserID)
	if err != nil {
		return err
	}
	if !has {
		if _, err := sess.Insert(&assignment); err != nil {
			return err
		}
	} else {
		_, err := sess.Where("role_id = ? AND user_id = ?", assignment.RoleID, assignment.UserID).MustCols("org_id").Update(&assignment)
		if err != nil {
			return err
		}
	}
	return nil
}

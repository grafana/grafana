package database

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

// TimeNow makes it possible to test usage of time
var TimeNow = time.Now

type AccessControlStore struct {
	SQLStore *sqlstore.SQLStore `inject:""`
}

func init() {
	registry.RegisterService(&AccessControlStore{})
}

func (ac *AccessControlStore) Init() error {
	return nil
}

func (ac *AccessControlStore) GetRoles(ctx context.Context, orgID int64) ([]*accesscontrol.Role, error) {
	var result []*accesscontrol.Role
	err := ac.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		roles := make([]*accesscontrol.Role, 0)
		q := "SELECT id, uid, org_id, name, description, updated FROM role WHERE org_id = ?"
		if err := sess.SQL(q, orgID).Find(&roles); err != nil {
			return err
		}

		result = roles
		return nil
	})
	return result, err
}

func (ac *AccessControlStore) GetRole(ctx context.Context, orgID, roleID int64) (*accesscontrol.RoleDTO, error) {
	var result *accesscontrol.RoleDTO

	err := ac.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		role, err := getRoleById(sess, roleID, orgID)
		if err != nil {
			return err
		}

		permissions, err := getRolePermissions(sess, roleID)
		if err != nil {
			return err
		}

		role.Permissions = permissions
		result = role
		return nil
	})

	return result, err
}

func (ac *AccessControlStore) GetRoleByUID(ctx context.Context, orgId int64, uid string) (*accesscontrol.RoleDTO, error) {
	var result *accesscontrol.RoleDTO

	err := ac.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		role, err := getRoleByUID(sess, uid, orgId)
		if err != nil {
			return err
		}

		permissions, err := getRolePermissions(sess, role.ID)
		if err != nil {
			return err
		}

		role.Permissions = permissions
		result = role
		return nil
	})

	return result, err
}

func (ac *AccessControlStore) CreateRole(ctx context.Context, cmd accesscontrol.CreateRoleCommand) (*accesscontrol.Role, error) {
	var result *accesscontrol.Role

	err := ac.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		role, err := ac.createRole(sess, cmd)
		if err != nil {
			return err
		}

		result = role
		return nil
	})

	return result, err
}

func (ac *AccessControlStore) createRole(sess *sqlstore.DBSession, cmd accesscontrol.CreateRoleCommand) (*accesscontrol.Role, error) {
	if cmd.UID == "" {
		uid, err := generateNewRoleUID(sess, cmd.OrgID)
		if err != nil {
			return nil, fmt.Errorf("failed to generate UID for role %q: %w", cmd.Name, err)
		}
		cmd.UID = uid
	}

	role := &accesscontrol.Role{
		OrgID:       cmd.OrgID,
		UID:         cmd.UID,
		Name:        cmd.Name,
		Description: cmd.Description,
		Created:     TimeNow(),
		Updated:     TimeNow(),
	}

	if _, err := sess.Insert(role); err != nil {
		if ac.SQLStore.Dialect.IsUniqueConstraintViolation(err) && strings.Contains(err.Error(), "name") {
			return nil, fmt.Errorf("role with the name '%s' already exists: %w", cmd.Name, err)
		}
		return nil, err
	}

	return role, nil
}

func (ac *AccessControlStore) CreateRoleWithPermissions(ctx context.Context, cmd accesscontrol.CreateRoleWithPermissionsCommand) (*accesscontrol.RoleDTO, error) {
	var result *accesscontrol.RoleDTO

	err := ac.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		createRoleCmd := accesscontrol.CreateRoleCommand{
			OrgID:       cmd.OrgID,
			UID:         cmd.UID,
			Name:        cmd.Name,
			Description: cmd.Description,
		}

		role, err := ac.createRole(sess, createRoleCmd)
		if err != nil {
			return err
		}

		result = &accesscontrol.RoleDTO{
			ID:          role.ID,
			UID:         role.UID,
			OrgID:       role.OrgID,
			Name:        role.Name,
			Description: role.Description,
			Created:     role.Created,
			Updated:     role.Updated,
		}

		// Add permissions
		for _, p := range cmd.Permissions {
			createPermissionCmd := accesscontrol.CreatePermissionCommand{
				RoleID:     role.ID,
				Permission: p.Permission,
				Scope:      p.Scope,
			}

			permission, err := createPermission(sess, createPermissionCmd)
			if err != nil {
				return err
			}
			result.Permissions = append(result.Permissions, *permission)
		}

		return nil
	})

	return result, err
}

// UpdateRole updates role with permissions
func (ac *AccessControlStore) UpdateRole(ctx context.Context, cmd accesscontrol.UpdateRoleCommand) (*accesscontrol.RoleDTO, error) {
	var result *accesscontrol.RoleDTO
	err := ac.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// TODO: work with both ID and UID
		existingRole, err := getRoleByUID(sess, cmd.UID, cmd.OrgID)
		if err != nil {
			return err
		}

		version := existingRole.Version + 1
		if cmd.Version != 0 {
			if existingRole.Version >= cmd.Version {
				return fmt.Errorf(
					"could not update '%s' (UID %s) from version %d to %d: %w",
					cmd.Name,
					existingRole.UID,
					existingRole.Version,
					cmd.Version,
					accesscontrol.ErrVersionLE,
				)
			}
			version = cmd.Version
		}

		role := &accesscontrol.Role{
			ID:          existingRole.ID,
			UID:         existingRole.UID,
			Version:     version,
			OrgID:       existingRole.OrgID,
			Name:        cmd.Name,
			Description: cmd.Description,
			Updated:     TimeNow(),
		}

		affectedRows, err := sess.ID(existingRole.ID).Update(role)
		if err != nil {
			return err
		}

		if affectedRows == 0 {
			return accesscontrol.ErrRoleNotFound
		}

		result = &accesscontrol.RoleDTO{
			ID:          role.ID,
			Version:     version,
			UID:         role.UID,
			OrgID:       role.OrgID,
			Name:        role.Name,
			Description: role.Description,
			Created:     role.Created,
			Updated:     role.Updated,
		}

		// Delete role's permissions
		_, err = sess.Exec("DELETE FROM permission WHERE role_id = ?", existingRole.ID)
		if err != nil {
			return err
		}

		// Add permissions
		for _, p := range cmd.Permissions {
			createPermissionCmd := accesscontrol.CreatePermissionCommand{
				RoleID:     role.ID,
				Permission: p.Permission,
				Scope:      p.Scope,
			}

			permission, err := createPermission(sess, createPermissionCmd)
			if err != nil {
				return err
			}
			result.Permissions = append(result.Permissions, *permission)
		}

		return nil
	})

	return result, err
}

func (ac *AccessControlStore) DeleteRole(cmd *accesscontrol.DeleteRoleCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		roleId := cmd.ID
		if roleId == 0 {
			role, err := getRoleByUID(sess, cmd.UID, cmd.OrgID)
			if err != nil {
				return err
			}
			roleId = role.ID
		}

		// Delete role's permissions
		_, err := sess.Exec("DELETE FROM permission WHERE role_id = ?", roleId)
		if err != nil {
			return err
		}

		_, err = sess.Exec("DELETE FROM role WHERE id = ? AND org_id = ?", roleId, cmd.OrgID)
		if err != nil {
			return err
		}

		return nil
	})
}

func (ac *AccessControlStore) GetRolePermissions(ctx context.Context, roleID int64) ([]accesscontrol.Permission, error) {
	var result []accesscontrol.Permission
	err := ac.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		permissions, err := getRolePermissions(sess, roleID)
		if err != nil {
			return err
		}

		result = permissions
		return nil
	})
	return result, err
}

func (ac *AccessControlStore) CreatePermission(ctx context.Context, cmd accesscontrol.CreatePermissionCommand) (*accesscontrol.Permission, error) {
	var result *accesscontrol.Permission
	err := ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		permission, err := createPermission(sess, cmd)
		if err != nil {
			return err
		}

		result = permission
		return nil
	})

	return result, err
}

func (ac *AccessControlStore) UpdatePermission(cmd *accesscontrol.UpdatePermissionCommand) (*accesscontrol.Permission, error) {
	var result *accesscontrol.Permission
	err := ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		permission := &accesscontrol.Permission{
			Permission: cmd.Permission,
			Scope:      cmd.Scope,
			Updated:    TimeNow(),
		}

		affectedRows, err := sess.ID(cmd.ID).Update(permission)
		if err != nil {
			return err
		}

		if affectedRows == 0 {
			return accesscontrol.ErrPermissionNotFound
		}

		result = permission
		return nil
	})

	return result, err
}

func (ac *AccessControlStore) DeletePermission(ctx context.Context, cmd *accesscontrol.DeletePermissionCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Exec("DELETE FROM permission WHERE id = ?", cmd.ID)
		if err != nil {
			return err
		}

		return nil
	})
}

func (ac *AccessControlStore) GetTeamRoles(query *accesscontrol.GetTeamRolesQuery) ([]*accesscontrol.RoleDTO, error) {
	var result []*accesscontrol.RoleDTO
	err := ac.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		q := `SELECT
			role.id,
			role.name AS name,
			role.description AS description,
			role.updated FROM role AS role
			INNER JOIN team_role ON role.id = team_role.role_id AND team_role.team_id = ?
			WHERE role.org_id = ? `

		if err := sess.SQL(q, query.TeamID, query.OrgID).Find(&result); err != nil {
			return err
		}

		return nil
	})

	return result, err
}

func (ac *AccessControlStore) GetUserRoles(ctx context.Context, query accesscontrol.GetUserRolesQuery) ([]*accesscontrol.RoleDTO, error) {
	var result []*accesscontrol.RoleDTO
	err := ac.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// TODO: optimize this
		filter, params := ac.userRolesFilter(query.OrgID, query.UserID, query.Roles)

		q := `SELECT
			role.id,
			role.org_id,
			role.name,
			role.description,
			role.created,
			role.updated
				FROM role
				` + filter

		err := sess.SQL(q, params...).Find(&result)
		return err
	})

	return result, err
}

func (ac *AccessControlStore) GetUserPermissions(ctx context.Context, query accesscontrol.GetUserPermissionsQuery) ([]*accesscontrol.Permission, error) {
	var result []*accesscontrol.Permission
	err := ac.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		filter, params := ac.userRolesFilter(query.OrgID, query.UserID, query.Roles)

		// TODO: optimize this
		q := `SELECT
			permission.id,
			permission.role_id,
			permission.permission,
			permission.scope,
			permission.updated,
			permission.created
				FROM permission
				INNER JOIN role ON role.id = permission.role_id
				` + filter

		if err := sess.SQL(q, params...).Find(&result); err != nil {
			return err
		}

		return nil
	})

	return result, err
}

func (*AccessControlStore) userRolesFilter(orgID, userID int64, roles []string) (string, []interface{}) {
	q := `WHERE role.id IN (
		SELECT up.role_id FROM user_role AS up WHERE up.user_id = ?
		UNION
		SELECT tp.role_id FROM team_role as tp
			INNER JOIN team_member as tm ON tm.team_id = tp.team_id
			WHERE tm.user_id = ?`
	params := []interface{}{userID, userID}

	if len(roles) != 0 {
		q += `
	UNION
	SELECT br.role_id FROM builtin_role AS br
	WHERE role IN (? ` + strings.Repeat(", ?", len(roles)-1) + `)`
		for _, role := range roles {
			params = append(params, role)
		}
	}

	q += `) and role.org_id = ?`
	params = append(params, orgID)

	return q, params
}

func (ac *AccessControlStore) AddTeamRole(cmd *accesscontrol.AddTeamRoleCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		role, err := getRoleByUID(sess, cmd.RoleUID, cmd.OrgID)
		if err != nil {
			return err
		}

		if _, err := teamExists(cmd.OrgID, cmd.TeamID, sess); err != nil {
			return err
		}

		if res, err := sess.Query("SELECT 1 from team_role WHERE org_id=? and team_id=? and role_id=?", cmd.OrgID, cmd.TeamID, role.ID); err != nil {
			return err
		} else if len(res) == 1 {
			return accesscontrol.ErrTeamRoleAlreadyAdded
		}

		teamRole := &accesscontrol.TeamRole{
			OrgID:   cmd.OrgID,
			TeamID:  cmd.TeamID,
			RoleID:  role.ID,
			Created: TimeNow(),
		}

		_, err = sess.Insert(teamRole)
		return err
	})
}

func (ac *AccessControlStore) RemoveTeamRole(cmd *accesscontrol.RemoveTeamRoleCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		role, err := getRoleByUID(sess, cmd.RoleUID, cmd.OrgID)
		if err != nil {
			return err
		}

		if _, err := teamExists(cmd.OrgID, cmd.TeamID, sess); err != nil {
			return err
		}

		q := "DELETE FROM team_role WHERE org_id=? and team_id=? and role_id=?"
		res, err := sess.Exec(q, cmd.OrgID, cmd.TeamID, role.ID)
		if err != nil {
			return err
		}
		rows, err := res.RowsAffected()
		if rows == 0 {
			return accesscontrol.ErrTeamRoleNotFound
		}

		return err
	})
}

func (ac *AccessControlStore) AddUserRole(cmd *accesscontrol.AddUserRoleCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		role, err := getRoleByUID(sess, cmd.RoleUID, cmd.OrgID)
		if err != nil {
			return err
		}

		if res, err := sess.Query("SELECT 1 from user_role WHERE org_id=? and user_id=? and role_id=?", cmd.OrgID, cmd.UserID, role.ID); err != nil {
			return err
		} else if len(res) == 1 {
			return accesscontrol.ErrUserRoleAlreadyAdded
		}

		userRole := &accesscontrol.UserRole{
			OrgID:   cmd.OrgID,
			UserID:  cmd.UserID,
			RoleID:  role.ID,
			Created: TimeNow(),
		}

		_, err = sess.Insert(userRole)
		return err
	})
}

func (ac *AccessControlStore) RemoveUserRole(cmd *accesscontrol.RemoveUserRoleCommand) error {
	return ac.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		role, err := getRoleByUID(sess, cmd.RoleUID, cmd.OrgID)
		if err != nil {
			return err
		}

		q := "DELETE FROM user_role WHERE org_id=? and user_id=? and role_id=?"
		res, err := sess.Exec(q, cmd.OrgID, cmd.UserID, role.ID)
		if err != nil {
			return err
		}
		rows, err := res.RowsAffected()
		if rows == 0 {
			return accesscontrol.ErrUserRoleNotFound
		}

		return err
	})
}

func (ac *AccessControlStore) AddBuiltinRole(ctx context.Context, orgID, roleID int64, roleName string) error {
	if !models.RoleType(roleName).IsValid() && roleName != "Grafana Admin" {
		return fmt.Errorf("role '%s' is not a valid role", roleName)
	}

	return ac.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if res, err := sess.Query("SELECT 1 from builtin_role WHERE role_id=? and role=?", roleID, roleName); err != nil {
			return err
		} else if len(res) == 1 {
			return accesscontrol.ErrUserRoleAlreadyAdded
		}

		if _, err := roleExists(orgID, roleID, sess); err != nil {
			return err
		}

		role := accesscontrol.BuiltinRole{
			RoleID:  roleID,
			Role:    roleName,
			Updated: TimeNow(),
			Created: TimeNow(),
		}

		_, err := sess.Table("builtin_role").Insert(role)
		return err
	})
}

func getRoleById(sess *sqlstore.DBSession, roleId int64, orgId int64) (*accesscontrol.RoleDTO, error) {
	role := accesscontrol.Role{OrgID: orgId, ID: roleId}
	has, err := sess.Get(&role)
	if !has {
		return nil, accesscontrol.ErrRoleNotFound
	}
	if err != nil {
		return nil, err
	}

	roleDTO := accesscontrol.RoleDTO{
		ID:          roleId,
		OrgID:       role.OrgID,
		Name:        role.Name,
		Description: role.Description,
		Permissions: nil,
		Created:     role.Created,
		Updated:     role.Updated,
	}

	return &roleDTO, nil
}

func getRoleByUID(sess *sqlstore.DBSession, uid string, orgId int64) (*accesscontrol.RoleDTO, error) {
	role := accesscontrol.Role{OrgID: orgId, UID: uid}
	has, err := sess.Get(&role)
	if !has {
		return nil, accesscontrol.ErrRoleNotFound
	}
	if err != nil {
		return nil, err
	}

	roleDTO := accesscontrol.RoleDTO{
		ID:          role.ID,
		UID:         role.UID,
		Version:     role.Version,
		OrgID:       role.OrgID,
		Name:        role.Name,
		Description: role.Description,
		Permissions: nil,
		Created:     role.Created,
		Updated:     role.Updated,
	}

	return &roleDTO, nil
}

func getRolePermissions(sess *sqlstore.DBSession, roleId int64) ([]accesscontrol.Permission, error) {
	permissions := make([]accesscontrol.Permission, 0)
	q := "SELECT id, role_id, permission, scope, updated, created FROM permission WHERE role_id = ?"
	if err := sess.SQL(q, roleId).Find(&permissions); err != nil {
		return nil, err
	}

	return permissions, nil
}

func createPermission(sess *sqlstore.DBSession, cmd accesscontrol.CreatePermissionCommand) (*accesscontrol.Permission, error) {
	permission := &accesscontrol.Permission{
		RoleID:     cmd.RoleID,
		Permission: cmd.Permission,
		Scope:      cmd.Scope,
		Created:    TimeNow(),
		Updated:    TimeNow(),
	}

	if _, err := sess.Insert(permission); err != nil {
		return nil, err
	}

	return permission, nil
}

func teamExists(orgId int64, teamId int64, sess *sqlstore.DBSession) (bool, error) {
	if res, err := sess.Query("SELECT 1 from team WHERE org_id=? and id=?", orgId, teamId); err != nil {
		return false, err
	} else if len(res) != 1 {
		return false, accesscontrol.ErrTeamNotFound
	}

	return true, nil
}

func roleExists(orgId int64, roleId int64, sess *sqlstore.DBSession) (bool, error) {
	if res, err := sess.Query("SELECT 1 from role WHERE org_id=? and id=?", orgId, roleId); err != nil {
		return false, err
	} else if len(res) != 1 {
		return false, accesscontrol.ErrRoleNotFound
	}

	return true, nil
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

	return "", accesscontrol.ErrRoleFailedGenerateUniqueUID
}

func MockTimeNow() {
	var timeSeed int64
	TimeNow = func() time.Time {
		fakeNow := time.Unix(timeSeed, 0).UTC()
		timeSeed++
		return fakeNow
	}
}

func ResetTimeNow() {
	TimeNow = time.Now
}

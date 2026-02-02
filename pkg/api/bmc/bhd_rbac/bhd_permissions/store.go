package bhd_permissions

import (
	"context"

	"github.com/grafana/grafana/pkg/services/msp"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type WithDbSession func(ctx context.Context, callback sqlstore.DBTransactionFunc) error

// GetRbacRolePermissions will return the list of all permissions for a given role
func GetRbacRolePermissions(ctx context.Context, withDbSession WithDbSession, query GetRolePermissionDTO) ([]BHDOrgRolePermission, error) {
	permissions := make([]BHDOrgRolePermission, 0)
	err := withDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// check if role is valid or not
		count, _ := sess.Table("bhd_role").Where("bhd_role_id=? AND (org_id = ? OR system_role = ?)", query.RoleID, query.OrgID, true).Count()
		if count == 0 {
			return ErrRoleDoesNotExist
		}

		rawSQL := `
		SELECT p.name, "group", description, p.display_name, p.default_permission, (
			CASE WHEN p.name IN (
				SELECT name
				FROM bhd_role_permission rp
				WHERE p.name = rp.bhd_permission_name
				AND rp.bhd_role_id=?
			) THEN true ELSE p.default_permission END) as status
		FROM bhd_permission p
		WHERE p.is_active IS TRUE
		GROUP BY 1
		ORDER BY 1`
		return sess.SQL(rawSQL, query.RoleID).Find(&permissions)
	})

	return permissions, err
}

// UpdateRbacRolePermissions will update the list of permissions for a given role
func UpdateRbacRolePermissions(ctx context.Context, withDbSession WithDbSession, query UpdateRolePermissionsQuery) error {
	err := withDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// If role is role_system then do not allow to update permissions
		if msp.Includes(query.RoleID, []int64{1, 2, 3}) {
			return ErrCannotUpdateSystemRole
		}

		// check if role is associated to org or not
		count, _ := sess.Table("bhd_role").
			Where("bhd_role_Id = ?", query.RoleID).
			Where("org_id = ?", query.OrgID).
			Count()
		if count == 0 {
			return ErrRoleDoesNotExist
		}

		deleteQuery := DeleteByRoleIDQuery{RoleID: query.RoleID, OrgID: query.OrgID}
		if _, err := sess.Table("bhd_role_permission").Delete(deleteQuery); err != nil {
			return err
		}

		permissions := make([]InsertBhdRolePermission, 0)
		for _, permissionName := range query.Permissions {
			permissions = append(permissions, InsertBhdRolePermission{
				RoleID:         query.RoleID,
				PermissionName: permissionName,
				OrgID:          query.OrgID,
			})
		}
		if _, err := sess.Table("bhd_role_permission").InsertMulti(permissions); err != nil {
			return err
		}
		return nil
	})
	return err
}

// GetRbacRolePermissionsByUserID will return the list of all permissions for the given user either directly or from teams
func GetRbacRolePermissionsByUserID(ctx context.Context, withDbSession WithDbSession, userID int64) ([]BHDOrgRolePermission, error) {
	permissions := make([]BHDOrgRolePermission, 0)
	rawSQL := `SELECT p.name, "group", description, (
		CASE WHEN p.name IN (
			SELECT DISTINCT bhd_permission_name as name
			FROM bhd_role_permission
			WHERE bhd_role_id IN (
			  	SELECT bhd_role_id
			  	FROM user_bhd_role
				WHERE user_id = ?
			) OR bhd_role_id IN (
				SELECT bhd_role_id
			 	FROM team_member tm
			  	INNER JOIN team_bhd_role r ON r.team_id = tm.team_id
			  	WHERE user_id = ?
			) ORDER BY 1
			) THEN true ELSE p.default_permission END) as status
		FROM bhd_permission p
		WHERE p.is_active IS TRUE
		GROUP BY 1
		ORDER BY 1`

	err := withDbSession(ctx, func(sess *sqlstore.DBSession) error {
		return sess.SQL(rawSQL, userID, userID).Find(&permissions)
	})

	return permissions, err
}

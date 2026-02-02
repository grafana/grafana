package bhd_permissions

import "errors"

var (
	ErrInvalidRoleID             = errors.New("Invalid role ID")
	ErrInvalidPayload            = errors.New("Invalid payload")
	ErrFailedToGetPermissions    = errors.New("Failed to get permissions list")
	ErrRoleDoesNotExist          = errors.New("Role does not exist")
	ErrFailedToUpdatePermissions = errors.New("Failed to update permissions list")
	ErrCannotUpdateSystemRole    = errors.New("System roles are not allowed to be updated")
)

type BHDOrgRolePermission struct {
	Name        string `json:"name" xorm:"name"`
	Group       string `json:"group" xorm:"group"`
	Description string `json:"description" xorm:"description"`
	DisplayName string `json:"displayName" xorm:"display_name"`
	Status      bool   `json:"status" xorm:"status"`
	IsDefault   bool   `json:"isDefault" xorm:"default_permission"`
}

type InsertBhdRolePermission struct {
	RoleID         int64  `xorm:"bhd_role_id"`
	PermissionName string `xorm:"bhd_permission_name"`
	OrgID          int64  `xorm:"org_id"`
}

type DeleteByRoleIDQuery struct {
	RoleID int64 `json:"role_id" xorm:"bhd_role_id"`
	OrgID  int64 `json:"org_id" xorm:"org_id"`
}

type UpdateRolePermissionsQuery struct {
	RoleID      int64    `json:"role_id" xorm:"bhd_role_id"`
	OrgID       int64    `json:"org_id" xorm:"org_id"`
	Permissions []string `json:"permissions" xorm:"extends"`
}

func GetMapPermissions(permissions []BHDOrgRolePermission) map[string]bool {
	resp := make(map[string]bool)
	for _, permission := range permissions {
		relatedPermissions := GetRelatedPermissions(permission.Name)
		for _, relatedPermission := range relatedPermissions {
			resp[relatedPermission] = permission.Status
		}
	}
	return resp
}

func GetRelatedPermissions(permissionName string) []string {
	permissions := make([]string, 0)
	switch permissionName {
	case "dashboards:create":
		permissions = []string{
			"dashboards:read", "dashboards:create",
			"dashboards:write", "dashboards:delete",
			"dashboards.permissions:read", "dashboards.permissions:write",
			"org.users:read", "teams:read", "calculated.fields:read",
		}
	case "folders:create":
		permissions = []string{
			"folders:read", "folders:create",
			"folders:write", "folders:delete",
			"folders.permissions:read", "folders.permissions:write",
		}
	case "administration.datasources:manage":
		permissions = []string{
			"datasources:read", "datasources:create",
			"datasources:write", "datasources:delete",
			"datasources.id:read", "datasources:explore",
		}
	case "administration.reports:manage":
		permissions = []string{
			"reports:access", "reports.history:read",
			"reports.settings:read", "reports.settings:write",
		}
	case "datasources:explore":
		permissions = []string{
			"datasources:explore", "calculated.fields:read",
		}
	}

	permissions = append(permissions, permissionName)
	return permissions
}

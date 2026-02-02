package bhd_permissions

type GetRolePermissionDTO struct {
	OrgID  int64
	RoleID int64
}

type UpdateRolePermissionsDTO struct {
	Permissions []string `json:"permissions"`
}

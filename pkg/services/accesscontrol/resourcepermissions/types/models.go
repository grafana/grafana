package types

type SetResourcePermissionCommand struct {
	Actions    []string
	Resource   string
	ResourceID string
	Permission string
}

type GetResourcesPermissionsQuery struct {
	Actions     []string
	Resource    string
	ResourceIDs []string
	OnlyManaged bool
}

type SetResourcePermissionsCommand struct {
	UserID      int64
	TeamID      int64
	BuiltinRole string

	Actions    []string
	Resource   string
	ResourceID string
	Permission string
}

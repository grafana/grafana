package types

import "github.com/grafana/grafana/pkg/services/accesscontrol"

type SetResourcePermissionCommand struct {
	Actions    []string
	Resource   string
	ResourceID string
	Permission string
}

type SetResourcePermissionsCommand struct {
	User        accesscontrol.User
	TeamID      int64
	BuiltinRole string

	SetResourcePermissionCommand
}

type GetResourcesPermissionsQuery struct {
	Actions     []string
	Resource    string
	ResourceIDs []string
	OnlyManaged bool
}

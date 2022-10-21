package resourcepermissions

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
)

type SetResourcePermissionCommand struct {
	Actions           []string
	Resource          string
	ResourceID        string
	ResourceAttribute string
	Permission        string
}

type SetResourcePermissionsCommand struct {
	User        accesscontrol.User
	TeamID      int64
	BuiltinRole string

	SetResourcePermissionCommand
}

type GetResourcePermissionsQuery struct {
	Actions              []string
	Resource             string
	ResourceID           string
	ResourceAttribute    string
	OnlyManaged          bool
	InheritedScopes      []string
	EnforceAccessControl bool
	User                 *user.SignedInUser
}

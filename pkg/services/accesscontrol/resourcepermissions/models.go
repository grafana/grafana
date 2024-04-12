package resourcepermissions

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
)

type SetResourcePermissionCommand struct {
	Actions           []string
	Resource          string
	ResourceID        string
	ResourceAttribute string
	Permission        string
	// The ActionSetName that would be created from the actions
	ActionSetName string
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
	User                 identity.Requester
}

package setting

import (
	"github.com/grafana/grafana/pkg/util"
)

type RBACSettings struct {
	// Enable permission cache
	PermissionCache bool
	// Enable Permission validation during role creation and provisioning
	PermissionValidationEnabled bool
	// Reset basic roles permissions on start-up
	ResetBasicRoles bool
	// RBAC single organization. This configuration option is subject to change.
	SingleOrganization bool

	OnlyStoreAccessActionSets bool

	// set of resources that should generate managed permissions when created
	managedPermissionsOnCreation map[string]struct{}

	// set of resources that should we should seed wildcard scopes for
	managedPermissionsWildcardSeed map[string]struct{}
}

func (c *Cfg) readRBACSettings() {
	s := RBACSettings{}

	rbac := c.Raw.Section("rbac")
	s.PermissionCache = rbac.Key("permission_cache").MustBool(true)
	s.PermissionValidationEnabled = rbac.Key("permission_validation_enabled").MustBool(false)
	s.ResetBasicRoles = rbac.Key("reset_basic_roles").MustBool(false)
	s.SingleOrganization = rbac.Key("single_organization").MustBool(false)
	s.OnlyStoreAccessActionSets = rbac.Key("only_store_access_action_sets").MustBool(false)

	resoruces := util.SplitString(rbac.Key("managed_permissions_on_creation").MustString(""))
	s.managedPermissionsOnCreation = map[string]struct{}{}
	for _, resource := range resoruces {
		s.managedPermissionsOnCreation[resource] = struct{}{}
	}

	resoruces = util.SplitString(rbac.Key("managed_permissions_wildcard_seeds").MustString(""))
	s.managedPermissionsWildcardSeed = map[string]struct{}{}
	for _, resource := range resoruces {
		s.managedPermissionsWildcardSeed[resource] = struct{}{}
	}

	c.RBAC = s
}

func (r RBACSettings) PermissionsOnCreation(resource string) bool {
	_, ok := r.managedPermissionsOnCreation[resource]
	return ok
}

func (r RBACSettings) PermissionsWildcardSeed(resource string) bool {
	_, ok := r.managedPermissionsWildcardSeed[resource]
	return ok

}

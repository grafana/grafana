package setting

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
}

func (c *Cfg) readRBACSettings() {
	s := RBACSettings{}

	rbac := c.Raw.Section("rbac")
	s.PermissionCache = rbac.Key("permission_cache").MustBool(true)
	s.PermissionValidationEnabled = rbac.Key("permission_validation_enabled").MustBool(false)
	s.ResetBasicRoles = rbac.Key("reset_basic_roles").MustBool(false)
	s.SingleOrganization = rbac.Key("single_organization").MustBool(false)
	s.OnlyStoreAccessActionSets = rbac.Key("only_store_access_action_sets").MustBool(false)

	c.RBAC = s
}

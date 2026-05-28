package setting

import (
	"time"

	"github.com/grafana/grafana/pkg/util"
)

// DefaultBasicRoleAggregatorInterval is the production tick cadence of the
// enterprise basic-role aggregator background service. Exposed so the test
// infra can refer to it when constructing GrafanaOpts.
const DefaultBasicRoleAggregatorInterval = 30 * time.Second

type RBACSettings struct {
	// Enable permission cache
	PermissionCache bool
	// Enable Permission validation during role creation and provisioning
	PermissionValidationEnabled bool
	// Reset basic roles permissions on start-up
	ResetBasicRoles bool
	// RBAC single organization. This configuration option is subject to change.
	SingleOrganization bool
	// PluginsCleanup lists plugin IDs whose RBAC data (roles, permissions, seed assignments)
	// should be purged from the database at startup.
	PluginsCleanup []string
	// BasicRoleAggregatorInterval is the running-loop tick cadence of the
	// enterprise basic-role aggregator. Defaults to 30s. Tests shrink it to
	// milliseconds so they can poll for aggregator output without waiting
	// the production interval.
	BasicRoleAggregatorInterval time.Duration
	// set of resources that should generate managed permissions when created
	resourcesWithPermissionsOnCreation map[string]struct{}

	// set of resources that should we should seed wildcard scopes for
	resourcesWithWildcardSeed map[string]struct{}
}

func (cfg *Cfg) readRBACSettings() {
	s := RBACSettings{}

	rbac := cfg.Raw.Section("rbac")
	s.PermissionCache = rbac.Key("permission_cache").MustBool(true)
	s.PermissionValidationEnabled = rbac.Key("permission_validation_enabled").MustBool(false)
	s.ResetBasicRoles = rbac.Key("reset_basic_roles").MustBool(false)
	s.SingleOrganization = rbac.Key("single_organization").MustBool(false)
	s.PluginsCleanup = util.SplitString(rbac.Key("plugins_cleanup").MustString(""))
	s.BasicRoleAggregatorInterval = rbac.Key("basic_role_aggregator_interval").MustDuration(DefaultBasicRoleAggregatorInterval)

	// List of resources to generate managed permissions for upon resource creation (dashboard, folder, service-account, datasource)
	resources := util.SplitString(rbac.Key("resources_with_managed_permissions_on_creation").MustString("dashboard, folder, service-account, datasource"))
	s.resourcesWithPermissionsOnCreation = map[string]struct{}{}
	for _, resource := range resources {
		s.resourcesWithPermissionsOnCreation[resource] = struct{}{}
	}

	// List of resources to seed managed permission wildcards for (dashboard, folder, datasource)
	resources = util.SplitString(rbac.Key("resources_with_seeded_wildcard_access").MustString(""))
	s.resourcesWithWildcardSeed = map[string]struct{}{}
	for _, resource := range resources {
		s.resourcesWithWildcardSeed[resource] = struct{}{}
	}

	cfg.RBAC = s
}

func (r RBACSettings) PermissionsOnCreation(resource string) bool {
	_, ok := r.resourcesWithPermissionsOnCreation[resource]
	return ok
}

func (r RBACSettings) PermissionsWildcardSeed(resource string) bool {
	_, ok := r.resourcesWithWildcardSeed[resource]
	return ok
}

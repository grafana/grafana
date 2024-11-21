package setting

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
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
	// If zanzana feature toggle is enabled this controls how often we
	// run the zanzana reconciliation loop.
	ZanzanaReconciliationInterval time.Duration

	OnlyStoreAccessActionSets bool

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
	s.OnlyStoreAccessActionSets = rbac.Key("only_store_access_action_sets").MustBool(false)

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

	var err error
	s.ZanzanaReconciliationInterval, err = gtime.ParseDuration(rbac.Key("zanzana_reconciliation_interval").MustString("1h"))
	if err != nil {
		s.ZanzanaReconciliationInterval = 1 * time.Hour
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

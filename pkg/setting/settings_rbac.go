package setting

import (
	"time"

	"github.com/grafana/grafana/pkg/infra/leaderelection"
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
	// PluginsCleanup lists plugin IDs whose RBAC data (roles, permissions, seed assignments)
	// should be purged from the database at startup.
	PluginsCleanup []string
	// GlobalRoleSeedingEnabled turns the enterprise GlobalRole seeding process
	// on or off as a whole — both the fixed-role GlobalRole seeder and the
	// basic-role aggregator background services. Defaults to false: seeding is
	// opt-in while the Mode 5 GlobalRole path is being stabilised. When false
	// both services report IsDisabled() regardless of Mode 5 or license state.
	GlobalRoleSeedingEnabled bool
	// LeaderElection configures HA leader election for the single-tenant
	// GlobalRole seeder and basic-role aggregator background services. When
	// disabled (the default) those services run with an always-leader elector,
	// preserving the pre-leader-election behaviour. When enabled they elect a
	// leader via the unified-storage KV lease (same backend as the embedded
	// zanzana reconciler). The LeaseName field is set per-service in code; the
	// value parsed here only carries the shared knobs (enabled, durations,
	// identity).
	LeaderElection leaderelection.Config
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
	s.GlobalRoleSeedingEnabled = rbac.Key("global_role_seeding_enabled").MustBool(false)

	// Leader election for the GlobalRole seeder / basic-role aggregator. The
	// LeaseName is intentionally left empty here and set per-service in the
	// elector providers (each service gets its own lease). Defaults mirror the
	// zanzana reconciler's leader-election knobs. RenewDeadline is unused by
	// the KV-lease elector (renewal is internal) but parsed for parity.
	leaderSec := cfg.SectionWithEnvOverrides("rbac.leader_election")
	s.LeaderElection = leaderelection.Config{
		Enabled:       leaderSec.Key("enabled").MustBool(false),
		Namespace:     leaderSec.Key("namespace").MustString(""),
		Identity:      leaderSec.Key("identity").MustString(""),
		LeaseDuration: leaderSec.Key("lease_duration").MustDuration(15 * time.Second),
		RenewDeadline: leaderSec.Key("renew_deadline").MustDuration(10 * time.Second),
		RetryPeriod:   leaderSec.Key("retry_period").MustDuration(2 * time.Second),
	}

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

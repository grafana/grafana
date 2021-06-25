package ossaccesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/evaluator"
	acregistry "github.com/grafana/grafana/pkg/services/accesscontrol/registry"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

// OSSAccessControlService is the service implementing role based access control.
type OSSAccessControlService struct {
	Cfg        *setting.Cfg          `inject:""`
	UsageStats usagestats.UsageStats `inject:""`
	Log        log.Logger
}

// Init initializes the OSSAccessControlService.
func (ac *OSSAccessControlService) Init() error {
	ac.Log = log.New("accesscontrol")

	ac.registerUsageMetrics()

	return acregistry.RegisterRegistrantsRoles(context.TODO(), ac)
}

func (ac *OSSAccessControlService) IsDisabled() bool {
	if ac.Cfg == nil {
		return true
	}

	_, exists := ac.Cfg.FeatureToggles["accesscontrol"]
	return !exists
}

func (ac *OSSAccessControlService) registerUsageMetrics() {
	ac.UsageStats.RegisterMetricsFunc(func() (map[string]interface{}, error) {
		return map[string]interface{}{
			"stats.oss.accesscontrol.enabled.count": ac.getUsageMetrics(),
		}, nil
	})
}

func (ac *OSSAccessControlService) getUsageMetrics() interface{} {
	if ac.IsDisabled() {
		return 0
	}

	return 1
}

func (ac *OSSAccessControlService) saveFixedRole(role accesscontrol.RoleDTO) {
	if storedRole, ok := accesscontrol.FixedRoles[role.Name]; ok {
		// If a package wants to override another package's role, the version
		// needs to be increased. Hence, we don't overwrite a role with a
		// greater version.
		if storedRole.Version >= role.Version {
			return
		}
	}
	// Save role
	accesscontrol.FixedRoles[role.Name] = role
}

func (ac *OSSAccessControlService) assignFixedRole(role accesscontrol.RoleDTO, builtInRoles []string) {
	for _, builtInRole := range builtInRoles {
		assignments := []string{}

		// Only record new assignments
		alreadyAssigned := false
		if assignments, ok := accesscontrol.FixedRoleGrants[builtInRole]; ok {
			for _, assignedRole := range assignments {
				if assignedRole == role.Name {
					alreadyAssigned = true
				}
			}
		}
		if !alreadyAssigned {
			assignments = append(assignments, role.Name)
			accesscontrol.FixedRoleGrants[builtInRole] = assignments
		}
	}
}

// RegisterFixedRole saves a fixed role and assigns it to built-in roles
func (ac *OSSAccessControlService) RegisterFixedRole(_ context.Context, role accesscontrol.RoleDTO, builtInRoles []string) error {
	err := accesscontrol.ValidateFixedRole(role)
	if err != nil {
		return err
	}

	err = accesscontrol.ValidateBuiltInRoles(builtInRoles)
	if err != nil {
		return err
	}

	ac.saveFixedRole(role)

	ac.assignFixedRole(role, builtInRoles)

	return nil
}

// Evaluate evaluates access to the given resource
func (ac *OSSAccessControlService) Evaluate(ctx context.Context, user *models.SignedInUser, permission string, scope ...string) (bool, error) {
	return evaluator.Evaluate(ctx, ac, user, permission, scope...)
}

// GetUserPermissions returns user permissions based on built-in roles
func (ac *OSSAccessControlService) GetUserPermissions(ctx context.Context, user *models.SignedInUser) ([]*accesscontrol.Permission, error) {
	timer := prometheus.NewTimer(metrics.MAccessPermissionsSummary)
	defer timer.ObserveDuration()

	builtinRoles := ac.GetUserBuiltInRoles(user)
	permissions := make([]*accesscontrol.Permission, 0)
	for _, builtin := range builtinRoles {
		if roleNames, ok := accesscontrol.FixedRoleGrants[builtin]; ok {
			for _, name := range roleNames {
				role, exists := accesscontrol.FixedRoles[name]
				if !exists {
					continue
				}
				for _, p := range role.Permissions {
					permission := p
					permissions = append(permissions, &permission)
				}
			}
		}
	}

	return permissions, nil
}

func (ac *OSSAccessControlService) GetUserBuiltInRoles(user *models.SignedInUser) []string {
	roles := []string{string(user.OrgRole)}
	for _, role := range user.OrgRole.Children() {
		roles = append(roles, string(role))
	}
	if user.IsGrafanaAdmin {
		roles = append(roles, accesscontrol.RoleGrafanaAdmin)
	}

	return roles
}

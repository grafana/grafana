package ossaccesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

func ProvideService(cfg *setting.Cfg, usageStats usagestats.Service) *OSSAccessControlService {
	s := &OSSAccessControlService{
		Cfg:        cfg,
		UsageStats: usageStats,
		Log:        log.New("accesscontrol"),
	}
	s.registerUsageMetrics()
	return s
}

// OSSAccessControlService is the service implementing role based access control.
type OSSAccessControlService struct {
	Cfg           *setting.Cfg
	UsageStats    usagestats.Service
	Log           log.Logger
	registrations accesscontrol.RegistrationList
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

// Evaluate evaluates access to the given resources
func (ac *OSSAccessControlService) Evaluate(ctx context.Context, user *models.SignedInUser, evaluator accesscontrol.Evaluator) (bool, error) {
	timer := prometheus.NewTimer(metrics.MAccessEvaluationsSummary)
	defer timer.ObserveDuration()
	metrics.MAccessEvaluationCount.Inc()

	permissions, err := ac.GetUserPermissions(ctx, user)
	if err != nil {
		return false, err
	}

	groupedPermissions := accesscontrol.GroupScopesByAction(permissions)

	// TODO would it be better to work inside GetUserPermissions instead?
	resolvedPermissions, err := accesscontrol.ResolveGroupedPermissions(user, groupedPermissions)
	if err != nil {
		return false, err
	}

	return evaluator.Evaluate(resolvedPermissions)
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

func (ac *OSSAccessControlService) saveFixedRole(role accesscontrol.RoleDTO) {
	if storedRole, ok := accesscontrol.FixedRoles[role.Name]; ok {
		// If a package wants to override another package's role, the version
		// needs to be increased. Hence, we don't overwrite a role with a
		// greater version.
		if storedRole.Version >= role.Version {
			log.Debugf("role %v has already been stored in a greater version, skipping registration", role.Name)
			return
		}
	}
	// Save role
	accesscontrol.FixedRoles[role.Name] = role
}

func (ac *OSSAccessControlService) assignFixedRole(role accesscontrol.RoleDTO, builtInRoles []string) {
	for _, builtInRole := range builtInRoles {
		// Only record new assignments
		alreadyAssigned := false
		assignments, ok := accesscontrol.FixedRoleGrants[builtInRole]
		if ok {
			for _, assignedRole := range assignments {
				if assignedRole == role.Name {
					log.Debugf("role %v has already been assigned to %v", role.Name, builtInRole)
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

// RegisterFixedRoles registers all declared roles in RAM
func (ac *OSSAccessControlService) RegisterFixedRoles() error {
	// If accesscontrol is disabled no need to register roles
	if ac.IsDisabled() {
		return nil
	}
	var err error
	ac.registrations.Range(func(registration accesscontrol.RoleRegistration) bool {
		ac.registerFixedRole(registration.Role, registration.Grants)
		return true
	})
	return err
}

// RegisterFixedRole saves a fixed role and assigns it to built-in roles
func (ac *OSSAccessControlService) registerFixedRole(role accesscontrol.RoleDTO, builtInRoles []string) {
	ac.saveFixedRole(role)
	ac.assignFixedRole(role, builtInRoles)
}

// DeclareFixedRoles allow the caller to declare, to the service, fixed roles and their assignments
// to organization roles ("Viewer", "Editor", "Admin") or "Grafana Admin"
func (ac *OSSAccessControlService) DeclareFixedRoles(registrations ...accesscontrol.RoleRegistration) error {
	// If accesscontrol is disabled no need to register roles
	if ac.IsDisabled() {
		return nil
	}

	for _, r := range registrations {
		err := accesscontrol.ValidateFixedRole(r.Role)
		if err != nil {
			return err
		}

		err = accesscontrol.ValidateBuiltInRoles(r.Grants)
		if err != nil {
			return err
		}

		ac.registrations.Append(r)
	}

	return nil
}

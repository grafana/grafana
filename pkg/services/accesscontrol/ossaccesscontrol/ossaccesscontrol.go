package ossaccesscontrol

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/evaluator"
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

	return nil
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

func (ac *OSSAccessControlService) saveFixedRole(role accesscontrol.RoleDTO) error {
	if value, ok := accesscontrol.FixedRoles.Load(role.Name); ok {
		storedRole := value.(accesscontrol.RoleDTO)
		if storedRole.Version >= role.Version {
			return accesscontrol.ErrVersionLE
		}
	}
	// Save role
	accesscontrol.FixedRoles.Store(role.Name, role)

	return nil
}

func (ac *OSSAccessControlService) assignFixedRole(role accesscontrol.RoleDTO, builtInRoles []string) error {
	for _, builtInRole := range builtInRoles {
		assignments := []string{}
		if value, ok := accesscontrol.FixedRoleGrants.Load(builtInRole); ok {
			assignments = value.([]string)
			alreadyAssigned := false
			for _, assignedRole := range assignments {
				if assignedRole == role.Name {
					alreadyAssigned = true
				}
			}
			if alreadyAssigned {
				return accesscontrol.ErrBuiltinRoleAlreadyAdded
			}
		}
		assignments = append(assignments, role.Name)
		accesscontrol.FixedRoleGrants.Store(builtInRole, assignments)
	}
	return nil
}

func (ac *OSSAccessControlService) validateFixedRole(role accesscontrol.RoleDTO) error {
	if strings.HasPrefix(role.Name, accesscontrol.FixedRolePrefix) {
		return accesscontrol.ErrFixedRolePrefixMissing
	}
	return nil
}

// RegisterFixedRole saves a fixed role and assigns it to built-in roles
func (ac *OSSAccessControlService) RegisterFixedRole(ctx context.Context, role accesscontrol.RoleDTO, builtInRoles ...string) error {
	err := ac.saveFixedRole(role)
	if err != nil {
		return err
	}

	err = ac.assignFixedRole(role, builtInRoles)
	if err != nil {
		return err
	}

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
		if values, ok := accesscontrol.FixedRoleGrants.Load(builtin); ok {
			roleNames := values.([]string)
			for _, name := range roleNames {
				value, exists := accesscontrol.FixedRoles.Load(name)
				if !exists {
					continue
				}
				r := value.(accesscontrol.RoleDTO)
				for _, p := range r.Permissions {
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

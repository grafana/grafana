package ossaccesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/evaluator"
	"github.com/grafana/grafana/pkg/setting"
)

// OSSAccessControlService is the service implementing role based access control.
type OSSAccessControlService struct {
	Cfg *setting.Cfg `inject:""`
	Log log.Logger
}

// Init initializes the OSSAccessControlService.
func (ac *OSSAccessControlService) Init() error {
	ac.Log = log.New("accesscontrol")

	return nil
}

func (ac *OSSAccessControlService) IsDisabled() bool {
	if ac.Cfg == nil {
		return true
	}

	_, exists := ac.Cfg.FeatureToggles["accesscontrol"]
	return !exists
}

// Evaluate evaluates access to the given resource
func (ac *OSSAccessControlService) Evaluate(ctx context.Context, user *models.SignedInUser, permission string, scope ...string) (bool, error) {
	return evaluator.Evaluate(ctx, ac, user, permission, scope...)
}

// GetUserPermissions returns user permissions based on built-in roles
func (ac *OSSAccessControlService) GetUserPermissions(ctx context.Context, user *models.SignedInUser, roles []string) ([]*accesscontrol.Permission, error) {
	permissions := make([]*accesscontrol.Permission, 0)
	for _, legacyRole := range roles {
		if builtInRoleNames, ok := builtInRoleGrants[legacyRole]; ok {
			for _, builtInRoleName := range builtInRoleNames {
				builtInRole := getBuiltInRole(builtInRoleName)
				if builtInRole == nil {
					continue
				}
				for _, p := range builtInRole.Permissions {
					permission := p
					permissions = append(permissions, &permission)
				}
			}
		}
	}

	return permissions, nil
}

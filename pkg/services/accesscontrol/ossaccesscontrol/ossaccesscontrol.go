package ossaccesscontrol

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/api"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourceservices"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/prometheus/client_golang/prometheus"
)

func ProvideService(features featuremgmt.FeatureToggles, usageStats usagestats.Service,
	provider accesscontrol.PermissionsProvider, routeRegister routing.RouteRegister) *OSSAccessControlService {
	s := ProvideOSSAccessControl(features, usageStats, provider)
	s.registerUsageMetrics()
	if !s.IsDisabled() {
		api := api.AccessControlAPI{
			RouteRegister: routeRegister,
			AccessControl: s,
		}
		api.RegisterAPIEndpoints()
	}
	return s
}

// ProvideOSSAccessControl creates an oss implementation of access control without usage stats registration
func ProvideOSSAccessControl(features featuremgmt.FeatureToggles, usageStats usagestats.Service, provider accesscontrol.PermissionsProvider) *OSSAccessControlService {
	return &OSSAccessControlService{
		features:      features,
		provider:      provider,
		usageStats:    usageStats,
		log:           log.New("accesscontrol"),
		scopeResolver: accesscontrol.NewScopeResolver(),
	}
}

// OSSAccessControlService is the service implementing role based access control.
type OSSAccessControlService struct {
	log           log.Logger
	usageStats    usagestats.Service
	features      featuremgmt.FeatureToggles
	scopeResolver accesscontrol.ScopeResolver
	provider      accesscontrol.PermissionsProvider
	registrations accesscontrol.RegistrationList
}

func (ac *OSSAccessControlService) IsDisabled() bool {
	if ac.features == nil {
		return true
	}
	return !ac.features.IsEnabled(featuremgmt.FlagAccesscontrol)
}

func (ac *OSSAccessControlService) registerUsageMetrics() {
	ac.usageStats.RegisterMetricsFunc(func(context.Context) (map[string]interface{}, error) {
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

	if user.Permissions == nil {
		user.Permissions = map[int64]map[string][]string{}
	}

	if _, ok := user.Permissions[user.OrgId]; !ok {
		permissions, err := ac.GetUserPermissions(ctx, user, accesscontrol.Options{ReloadCache: true})
		if err != nil {
			return false, err
		}
		user.Permissions[user.OrgId] = accesscontrol.GroupScopesByAction(permissions)
	}

	attributeMutator := ac.scopeResolver.GetResolveAttributeScopeMutator(user.OrgId)
	resolvedEvaluator, err := evaluator.MutateScopes(ctx, attributeMutator)
	if err != nil {
		return false, err
	}
	return resolvedEvaluator.Evaluate(user.Permissions[user.OrgId])
}

// GetUserRoles returns user permissions based on built-in roles
func (ac *OSSAccessControlService) GetUserRoles(ctx context.Context, user *models.SignedInUser) ([]*accesscontrol.RoleDTO, error) {
	return nil, errors.New("unsupported function") //OSS users will continue to use builtin roles via GetUserPermissions
}

// GetUserPermissions returns user permissions based on built-in roles
func (ac *OSSAccessControlService) GetUserPermissions(ctx context.Context, user *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
	timer := prometheus.NewTimer(metrics.MAccessPermissionsSummary)
	defer timer.ObserveDuration()

	permissions := ac.getFixedPermissions(ctx, user)

	dbPermissions, err := ac.provider.GetUserPermissions(ctx, accesscontrol.GetUserPermissionsQuery{
		OrgID:   user.OrgId,
		UserID:  user.UserId,
		Roles:   ac.GetUserBuiltInRoles(user),
		Actions: resourceservices.TeamAdminActions,
	})
	if err != nil {
		return nil, err
	}

	permissions = append(permissions, dbPermissions...)
	resolved := make([]*accesscontrol.Permission, 0, len(permissions))
	keywordMutator := ac.scopeResolver.GetResolveKeywordScopeMutator(user)
	for _, p := range permissions {
		// if the permission has a keyword in its scope it will be resolved
		p.Scope, err = keywordMutator(ctx, p.Scope)
		if err != nil {
			return nil, err
		}
		resolved = append(resolved, p)
	}

	return resolved, nil
}

func (ac *OSSAccessControlService) getFixedPermissions(ctx context.Context, user *models.SignedInUser) []*accesscontrol.Permission {
	permissions := make([]*accesscontrol.Permission, 0)

	for _, builtin := range ac.GetUserBuiltInRoles(user) {
		if roleNames, ok := accesscontrol.FixedRoleGrants[builtin]; ok {
			for _, name := range roleNames {
				role, exists := accesscontrol.FixedRoles[name]
				if !exists {
					continue
				}
				for i := range role.Permissions {
					permissions = append(permissions, &role.Permissions[i])
				}
			}
		}
	}

	return permissions
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
			ac.log.Debug("the role has already been stored in a greater version, skipping registration", "role", role.Name)
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
					ac.log.Debug("the role has already been assigned", "rolename", role.Name, "build_in_role", builtInRole)
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

// RegisterAttributeScopeResolver allows the caller to register scope resolvers for a
// specific scope prefix (ex: datasources:name:)
func (ac *OSSAccessControlService) RegisterAttributeScopeResolver(scopePrefix string, resolver accesscontrol.AttributeScopeResolveFunc) {
	ac.scopeResolver.AddAttributeResolver(scopePrefix, resolver)
}

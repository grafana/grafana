package ossaccesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/api"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

func ProvideService(
	features featuremgmt.FeatureToggles, cfg *setting.Cfg,
	store accesscontrol.PermissionsStore, routeRegister routing.RouteRegister,
) (*OSSAccessControlService, error) {
	var errDeclareRoles error
	s := ProvideOSSAccessControl(cfg, store)
	if !s.IsDisabled() {
		api := api.AccessControlAPI{
			RouteRegister: routeRegister,
			AccessControl: s,
		}
		api.RegisterAPIEndpoints()

		errDeclareRoles = accesscontrol.DeclareFixedRoles(s)
	}

	return s, errDeclareRoles
}

func ProvideOSSAccessControl(cfg *setting.Cfg, store accesscontrol.PermissionsStore) *OSSAccessControlService {
	s := &OSSAccessControlService{
		cfg:            cfg,
		store:          store,
		log:            log.New("accesscontrol"),
		scopeResolvers: accesscontrol.NewScopeResolvers(),
		roles:          accesscontrol.BuildBasicRoleDefinitions(),
	}

	return s
}

// OSSAccessControlService is the service implementing role based access control.
type OSSAccessControlService struct {
	log            log.Logger
	cfg            *setting.Cfg
	scopeResolvers accesscontrol.ScopeResolvers
	store          accesscontrol.PermissionsStore
	registrations  accesscontrol.RegistrationList
	roles          map[string]*accesscontrol.RoleDTO
}

func (ac *OSSAccessControlService) IsDisabled() bool {
	if ac.cfg == nil {
		return true
	}
	return !ac.cfg.RBACEnabled
}

func (ac *OSSAccessControlService) GetUsageStats(_ context.Context) map[string]interface{} {
	return map[string]interface{}{
		"stats.oss.accesscontrol.enabled.count": ac.getUsageMetrics(),
	}
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

	attributeMutator := ac.scopeResolvers.GetScopeAttributeMutator(user.OrgId)
	resolvedEvaluator, err := evaluator.MutateScopes(ctx, attributeMutator)
	if err != nil {
		return false, err
	}
	return resolvedEvaluator.Evaluate(user.Permissions[user.OrgId]), nil
}

// GetUserPermissions returns user permissions based on built-in roles
func (ac *OSSAccessControlService) GetUserPermissions(ctx context.Context, user *models.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
	timer := prometheus.NewTimer(metrics.MAccessPermissionsSummary)
	defer timer.ObserveDuration()

	permissions := ac.getFixedPermissions(ctx, user)

	dbPermissions, err := ac.store.GetUserPermissions(ctx, accesscontrol.GetUserPermissionsQuery{
		OrgID:   user.OrgId,
		UserID:  user.UserId,
		Roles:   accesscontrol.GetOrgRoles(ac.cfg, user),
		Actions: append(TeamAdminActions, append(DashboardAdminActions, FolderAdminActions...)...),
	})
	if err != nil {
		return nil, err
	}

	permissions = append(permissions, dbPermissions...)
	keywordMutator := ac.scopeResolvers.GetScopeKeywordMutator(user)
	for i := range permissions {
		// if the permission has a keyword in its scope it will be resolved
		permissions[i].Scope, err = keywordMutator(ctx, permissions[i].Scope)
		if err != nil {
			return nil, err
		}
	}

	return permissions, nil
}

func (ac *OSSAccessControlService) getFixedPermissions(ctx context.Context, user *models.SignedInUser) []accesscontrol.Permission {
	permissions := make([]accesscontrol.Permission, 0)

	for _, builtin := range accesscontrol.GetOrgRoles(ac.cfg, user) {
		if basicRole, ok := ac.roles[builtin]; ok {
			permissions = append(permissions, basicRole.Permissions...)
		}
	}

	return permissions
}

// RegisterFixedRoles registers all declared roles in RAM
func (ac *OSSAccessControlService) RegisterFixedRoles(ctx context.Context) error {
	// If accesscontrol is disabled no need to register roles
	if ac.IsDisabled() {
		return nil
	}
	ac.registrations.Range(func(registration accesscontrol.RoleRegistration) bool {
		ac.registerFixedRole(registration.Role, registration.Grants)
		return true
	})
	return nil
}

// RegisterFixedRole saves a fixed role and assigns it to built-in roles
func (ac *OSSAccessControlService) registerFixedRole(role accesscontrol.RoleDTO, builtInRoles []string) {
	for br := range accesscontrol.BuiltInRolesWithParents(builtInRoles) {
		if basicRole, ok := ac.roles[br]; ok {
			basicRole.Permissions = append(basicRole.Permissions, role.Permissions...)
		} else {
			ac.log.Error("Unknown builtin role", "builtInRole", br)
		}
	}
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

// RegisterScopeAttributeResolver allows the caller to register scope resolvers for a
// specific scope prefix (ex: datasources:name:)
func (ac *OSSAccessControlService) RegisterScopeAttributeResolver(scopePrefix string, resolver accesscontrol.ScopeAttributeResolver) {
	ac.scopeResolvers.AddScopeAttributeResolver(scopePrefix, resolver)
}

func (ac *OSSAccessControlService) DeleteUserPermissions(ctx context.Context, userID int64) error {
	return ac.store.DeleteUserPermissions(ctx, userID)
}

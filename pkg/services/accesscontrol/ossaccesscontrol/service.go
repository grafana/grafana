package ossaccesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/api"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

func ProvideService(cfg *setting.Cfg, store accesscontrol.Store, routeRegister routing.RouteRegister) (*Service, error) {
	var errDeclareRoles error
	s := ProvideOSSService(cfg, store)
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

func ProvideOSSService(cfg *setting.Cfg, store accesscontrol.Store) *Service {
	s := &Service{
		cfg:            cfg,
		store:          store,
		log:            log.New("accesscontrol"),
		scopeResolvers: accesscontrol.NewScopeResolvers(),
		roles:          accesscontrol.BuildBasicRoleDefinitions(),
	}

	return s
}

// Service is the service implementing role based access control.
type Service struct {
	log            log.Logger
	cfg            *setting.Cfg
	scopeResolvers accesscontrol.ScopeResolvers
	store          accesscontrol.Store
	registrations  accesscontrol.RegistrationList
	roles          map[string]*accesscontrol.RoleDTO
}

func (s *Service) IsDisabled() bool {
	if s.cfg == nil {
		return true
	}
	return !s.cfg.RBACEnabled
}

func (s *Service) GetUsageStats(_ context.Context) map[string]interface{} {
	return map[string]interface{}{
		"stats.oss.accesscontrol.enabled.count": s.getUsageMetrics(),
	}
}

func (s *Service) getUsageMetrics() interface{} {
	if s.IsDisabled() {
		return 0
	}

	return 1
}

// Evaluate evaluates access to the given resources
func (s *Service) Evaluate(ctx context.Context, user *user.SignedInUser, evaluator accesscontrol.Evaluator) (bool, error) {
	timer := prometheus.NewTimer(metrics.MAccessEvaluationsSummary)
	defer timer.ObserveDuration()
	metrics.MAccessEvaluationCount.Inc()

	if user.Permissions == nil {
		user.Permissions = map[int64]map[string][]string{}
	}

	if _, ok := user.Permissions[user.OrgID]; !ok {
		permissions, err := s.GetUserPermissions(ctx, user, accesscontrol.Options{ReloadCache: true})
		if err != nil {
			return false, err
		}
		user.Permissions[user.OrgID] = accesscontrol.GroupScopesByAction(permissions)
	}

	attributeMutator := s.scopeResolvers.GetScopeAttributeMutator(user.OrgID)
	resolvedEvaluator, err := evaluator.MutateScopes(ctx, attributeMutator)
	if err != nil {
		return false, err
	}
	return resolvedEvaluator.Evaluate(user.Permissions[user.OrgID]), nil
}

var actionsToFetch = append(
	TeamAdminActions, append(DashboardAdminActions, FolderAdminActions...)...,
)

// GetUserPermissions returns user permissions based on built-in roles
func (s *Service) GetUserPermissions(ctx context.Context, user *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
	timer := prometheus.NewTimer(metrics.MAccessPermissionsSummary)
	defer timer.ObserveDuration()

	permissions := s.getFixedPermissions(ctx, user)

	dbPermissions, err := s.store.GetUserPermissions(ctx, accesscontrol.GetUserPermissionsQuery{
		OrgID:   user.OrgID,
		UserID:  user.UserID,
		Roles:   accesscontrol.GetOrgRoles(user),
		TeamIDs: user.Teams,
		Actions: actionsToFetch,
	})
	if err != nil {
		return nil, err
	}

	permissions = append(permissions, dbPermissions...)
	keywordMutator := s.scopeResolvers.GetScopeKeywordMutator(user)
	for i := range permissions {
		// if the permission has a keyword in its scope it will be resolved
		permissions[i].Scope, err = keywordMutator(ctx, permissions[i].Scope)
		if err != nil {
			return nil, err
		}
	}

	return permissions, nil
}

func (s *Service) getFixedPermissions(ctx context.Context, user *user.SignedInUser) []accesscontrol.Permission {
	permissions := make([]accesscontrol.Permission, 0)

	for _, builtin := range accesscontrol.GetOrgRoles(user) {
		if basicRole, ok := s.roles[builtin]; ok {
			permissions = append(permissions, basicRole.Permissions...)
		}
	}

	return permissions
}

// RegisterFixedRoles registers all declared roles in RAM
func (s *Service) RegisterFixedRoles(ctx context.Context) error {
	// If accesscontrol is disabled no need to register roles
	if s.IsDisabled() {
		return nil
	}
	s.registrations.Range(func(registration accesscontrol.RoleRegistration) bool {
		s.registerFixedRole(registration.Role, registration.Grants)
		return true
	})
	return nil
}

// RegisterFixedRole saves a fixed role and assigns it to built-in roles
func (s *Service) registerFixedRole(role accesscontrol.RoleDTO, builtInRoles []string) {
	for br := range accesscontrol.BuiltInRolesWithParents(builtInRoles) {
		if basicRole, ok := s.roles[br]; ok {
			basicRole.Permissions = append(basicRole.Permissions, role.Permissions...)
		} else {
			s.log.Error("Unknown builtin role", "builtInRole", br)
		}
	}
}

// DeclareFixedRoles allow the caller to declare, to the service, fixed roles and their assignments
// to organization roles ("Viewer", "Editor", "Admin") or "Grafana Admin"
func (s *Service) DeclareFixedRoles(registrations ...accesscontrol.RoleRegistration) error {
	// If accesscontrol is disabled no need to register roles
	if s.IsDisabled() {
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

		s.registrations.Append(r)
	}

	return nil
}

// RegisterScopeAttributeResolver allows the caller to register scope resolvers for a
// specific scope prefix (ex: datasources:name:)
func (s *Service) RegisterScopeAttributeResolver(scopePrefix string, resolver accesscontrol.ScopeAttributeResolver) {
	s.scopeResolvers.AddScopeAttributeResolver(scopePrefix, resolver)
}

func (s *Service) DeleteUserPermissions(ctx context.Context, orgID int64, userID int64) error {
	return s.store.DeleteUserPermissions(ctx, orgID, userID)
}

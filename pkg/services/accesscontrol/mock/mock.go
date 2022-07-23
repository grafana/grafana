package mock

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type fullAccessControl interface {
	accesscontrol.AccessControl
	GetUserBuiltInRoles(user *models.SignedInUser) []string
	RegisterFixedRoles(context.Context) error
}

type Calls struct {
	Evaluate                       []interface{}
	GetUserPermissions             []interface{}
	IsDisabled                     []interface{}
	DeclareFixedRoles              []interface{}
	GetUserBuiltInRoles            []interface{}
	RegisterFixedRoles             []interface{}
	RegisterAttributeScopeResolver []interface{}
	DeleteUserPermissions          []interface{}
}

type Mock struct {
	// Unless an override is provided, permissions will be returned by GetUserPermissions
	permissions []accesscontrol.Permission
	// Unless an override is provided, disabled will be returned by IsDisabled
	disabled bool
	// Unless an override is provided, builtInRoles will be returned by GetUserBuiltInRoles
	builtInRoles []string

	// Track the list of calls
	Calls Calls

	// Override functions
	EvaluateFunc                       func(context.Context, *models.SignedInUser, accesscontrol.Evaluator) (bool, error)
	GetUserPermissionsFunc             func(context.Context, *models.SignedInUser, accesscontrol.Options) ([]accesscontrol.Permission, error)
	IsDisabledFunc                     func() bool
	DeclareFixedRolesFunc              func(...accesscontrol.RoleRegistration) error
	GetUserBuiltInRolesFunc            func(user *models.SignedInUser) []string
	RegisterFixedRolesFunc             func() error
	RegisterScopeAttributeResolverFunc func(string, accesscontrol.ScopeAttributeResolver)
	DeleteUserPermissionsFunc          func(context.Context, int64) error

	scopeResolvers accesscontrol.ScopeResolvers
}

// Ensure the mock stays in line with the interface
var _ fullAccessControl = New()

func New() *Mock {
	mock := &Mock{
		Calls:          Calls{},
		disabled:       false,
		permissions:    []accesscontrol.Permission{},
		builtInRoles:   []string{},
		scopeResolvers: accesscontrol.NewScopeResolvers(),
	}

	return mock
}

func (m Mock) GetUsageStats(ctx context.Context) map[string]interface{} {
	return make(map[string]interface{})
}

func (m Mock) WithPermissions(permissions []accesscontrol.Permission) *Mock {
	m.permissions = permissions
	return &m
}

func (m Mock) WithDisabled() *Mock {
	m.disabled = true
	return &m
}

func (m Mock) WithBuiltInRoles(builtInRoles []string) *Mock {
	m.builtInRoles = builtInRoles
	return &m
}

// Evaluate evaluates access to the given resource.
// This mock uses GetUserPermissions to then call the evaluator Evaluate function.
func (m *Mock) Evaluate(ctx context.Context, user *models.SignedInUser, evaluator accesscontrol.Evaluator) (bool, error) {
	m.Calls.Evaluate = append(m.Calls.Evaluate, []interface{}{ctx, user, evaluator})
	// Use override if provided
	if m.EvaluateFunc != nil {
		return m.EvaluateFunc(ctx, user, evaluator)
	}

	var permissions map[string][]string
	if user.Permissions != nil && user.Permissions[user.OrgId] != nil {
		permissions = user.Permissions[user.OrgId]
	}

	if permissions == nil {
		userPermissions, err := m.GetUserPermissions(ctx, user, accesscontrol.Options{ReloadCache: true})
		if err != nil {
			return false, err
		}
		permissions = accesscontrol.GroupScopesByAction(userPermissions)
	}

	attributeMutator := m.scopeResolvers.GetScopeAttributeMutator(user.OrgId)
	resolvedEvaluator, err := evaluator.MutateScopes(ctx, attributeMutator)
	if err != nil {
		return false, err
	}
	return resolvedEvaluator.Evaluate(permissions), nil
}

// GetUserPermissions returns user permissions.
// This mock return m.permissions unless an override is provided.
func (m *Mock) GetUserPermissions(ctx context.Context, user *models.SignedInUser, opts accesscontrol.Options) ([]accesscontrol.Permission, error) {
	m.Calls.GetUserPermissions = append(m.Calls.GetUserPermissions, []interface{}{ctx, user, opts})
	// Use override if provided
	if m.GetUserPermissionsFunc != nil {
		return m.GetUserPermissionsFunc(ctx, user, opts)
	}
	// Otherwise return the Permissions list
	return m.permissions, nil
}

// Middleware checks if service disabled or not to switch to fallback authorization.
// This mock return m.disabled unless an override is provided.
func (m *Mock) IsDisabled() bool {
	m.Calls.IsDisabled = append(m.Calls.IsDisabled, struct{}{})
	// Use override if provided
	if m.IsDisabledFunc != nil {
		return m.IsDisabledFunc()
	}
	// Otherwise return the Disabled bool
	return m.disabled
}

// DeclareFixedRoles allow the caller to declare, to the service, fixed roles and their
// assignments to organization roles ("Viewer", "Editor", "Admin") or "Grafana Admin"
// This mock returns no error unless an override is provided.
func (m *Mock) DeclareFixedRoles(registrations ...accesscontrol.RoleRegistration) error {
	m.Calls.DeclareFixedRoles = append(m.Calls.DeclareFixedRoles, []interface{}{registrations})
	// Use override if provided
	if m.DeclareFixedRolesFunc != nil {
		return m.DeclareFixedRolesFunc(registrations...)
	}
	return nil
}

// GetUserBuiltInRoles returns the list of organizational roles ("Viewer", "Editor", "Admin")
// or "Grafana Admin" associated to a user
// This mock returns m.builtInRoles unless an override is provided.
func (m *Mock) GetUserBuiltInRoles(user *models.SignedInUser) []string {
	m.Calls.GetUserBuiltInRoles = append(m.Calls.GetUserBuiltInRoles, []interface{}{user})

	// Use override if provided
	if m.GetUserBuiltInRolesFunc != nil {
		return m.GetUserBuiltInRolesFunc(user)
	}

	// Otherwise return the BuiltInRoles list
	return m.builtInRoles
}

// RegisterFixedRoles registers all roles declared to AccessControl
// This mock returns no error unless an override is provided.
func (m *Mock) RegisterFixedRoles(ctx context.Context) error {
	m.Calls.RegisterFixedRoles = append(m.Calls.RegisterFixedRoles, []struct{}{})
	// Use override if provided
	if m.RegisterFixedRolesFunc != nil {
		return m.RegisterFixedRolesFunc()
	}
	return nil
}

func (m *Mock) RegisterScopeAttributeResolver(scopePrefix string, resolver accesscontrol.ScopeAttributeResolver) {
	m.scopeResolvers.AddScopeAttributeResolver(scopePrefix, resolver)
	m.Calls.RegisterAttributeScopeResolver = append(m.Calls.RegisterAttributeScopeResolver, []struct{}{})
	// Use override if provided
	if m.RegisterScopeAttributeResolverFunc != nil {
		m.RegisterScopeAttributeResolverFunc(scopePrefix, resolver)
	}
}

func (m *Mock) DeleteUserPermissions(ctx context.Context, userID int64) error {
	m.Calls.DeleteUserPermissions = append(m.Calls.DeleteUserPermissions, []interface{}{ctx, userID})
	// Use override if provided
	if m.DeleteUserPermissionsFunc != nil {
		return m.DeleteUserPermissionsFunc(ctx, userID)
	}
	return nil
}

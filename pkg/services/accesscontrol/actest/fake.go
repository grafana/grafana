package actest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
)

var _ accesscontrol.Service = new(FakeService)
var _ accesscontrol.RoleRegistry = new(FakeService)

type FakeService struct {
	ExpectedErr         error
	ExpectedDisabled    bool
	ExpectedPermissions []accesscontrol.Permission
}

func (f FakeService) GetUsageStats(ctx context.Context) map[string]interface{} {
	return map[string]interface{}{}
}

func (f FakeService) GetUserPermissions(ctx context.Context, user *user.SignedInUser, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	return f.ExpectedPermissions, f.ExpectedErr
}

func (f FakeService) DeleteUserPermissions(ctx context.Context, orgID, userID int64) error {
	return f.ExpectedErr
}

func (f FakeService) DeclareFixedRoles(registrations ...accesscontrol.RoleRegistration) error {
	return f.ExpectedErr
}

func (f FakeService) RegisterFixedRoles(ctx context.Context) error {
	return f.ExpectedErr
}

func (f FakeService) IsDisabled() bool {
	return f.ExpectedDisabled
}

var _ accesscontrol.AccessControl = new(FakeAccessControl)

type FakeAccessControl struct {
	ExpectedErr      error
	ExpectedDisabled bool
	ExpectedEvaluate bool
}

func (f FakeAccessControl) Evaluate(ctx context.Context, user *user.SignedInUser, evaluator accesscontrol.Evaluator) (bool, error) {
	return f.ExpectedEvaluate, f.ExpectedErr
}

func (f FakeAccessControl) RegisterScopeAttributeResolver(prefix string, resolver accesscontrol.ScopeAttributeResolver) {
}

func (f FakeAccessControl) IsDisabled() bool {
	return f.ExpectedDisabled
}

var _ accesscontrol.PermissionsService = new(FakePermissionService)

func NewFakePermissionsService() *FakePermissionService {
	return &FakePermissionService{}
}

type FakePermissionService struct {
	ExpectedErr         error
	ExpectedMapResult   string
	ExpectedPermission  *accesscontrol.ResourcePermission
	ExpectedPermissions []accesscontrol.ResourcePermission
}

func (f FakePermissionService) GetPermissions(ctx context.Context, user *user.SignedInUser, resourceID string) ([]accesscontrol.ResourcePermission, error) {
	return f.ExpectedPermissions, f.ExpectedErr
}

func (f FakePermissionService) SetUserPermission(ctx context.Context, orgID int64, user accesscontrol.User, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	return f.ExpectedPermission, f.ExpectedErr
}

func (f FakePermissionService) SetTeamPermission(ctx context.Context, orgID, teamID int64, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	return f.ExpectedPermission, f.ExpectedErr
}

func (f FakePermissionService) SetBuiltInRolePermission(ctx context.Context, orgID int64, builtInRole string, resourceID string, permission string) (*accesscontrol.ResourcePermission, error) {
	return f.ExpectedPermission, f.ExpectedErr
}

func (f FakePermissionService) SetPermissions(ctx context.Context, orgID int64, resourceID string, commands ...accesscontrol.SetResourcePermissionCommand) ([]accesscontrol.ResourcePermission, error) {
	return f.ExpectedPermissions, f.ExpectedErr
}

func (f FakePermissionService) MapActions(permission accesscontrol.ResourcePermission) string {
	return f.ExpectedMapResult
}

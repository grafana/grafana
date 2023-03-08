package actest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
)

var _ accesscontrol.Service = new(FakeService)
var _ accesscontrol.RoleRegistry = new(FakeService)

type FakeService struct {
	ExpectedErr                     error
	ExpectedDisabled                bool
	ExpectedCachedPermissions       bool
	ExpectedPermissions             []accesscontrol.Permission
	ExpectedFilteredUserPermissions []accesscontrol.Permission
	ExpectedUsersPermissions        map[int64][]accesscontrol.Permission
}

func (f FakeService) GetUsageStats(ctx context.Context) map[string]interface{} {
	return map[string]interface{}{}
}

func (f FakeService) GetUserPermissions(ctx context.Context, user *user.SignedInUser, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	return f.ExpectedPermissions, f.ExpectedErr
}

func (f FakeService) SearchUsersPermissions(ctx context.Context, user *user.SignedInUser, orgID int64, options accesscontrol.SearchOptions) (map[int64][]accesscontrol.Permission, error) {
	return f.ExpectedUsersPermissions, f.ExpectedErr
}

func (f FakeService) SearchUserPermissions(ctx context.Context, orgID int64, searchOptions accesscontrol.SearchOptions) ([]accesscontrol.Permission, error) {
	return f.ExpectedFilteredUserPermissions, f.ExpectedErr
}

func (f FakeService) ClearUserPermissionCache(user *user.SignedInUser) {}

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

func (f FakeService) SaveExternalServiceRole(ctx context.Context, cmd accesscontrol.SaveExternalServiceRoleCommand) error {
	return f.ExpectedErr
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

type FakeStore struct {
	ExpectedUserPermissions  []accesscontrol.Permission
	ExpectedUsersPermissions map[int64][]accesscontrol.Permission
	ExpectedUsersRoles       map[int64][]string
	ExpectedErr              error
}

func (f FakeStore) GetUserPermissions(ctx context.Context, query accesscontrol.GetUserPermissionsQuery) ([]accesscontrol.Permission, error) {
	return f.ExpectedUserPermissions, f.ExpectedErr
}

func (f FakeStore) SearchUsersPermissions(ctx context.Context, orgID int64, options accesscontrol.SearchOptions) (map[int64][]accesscontrol.Permission, error) {
	return f.ExpectedUsersPermissions, f.ExpectedErr
}

func (f FakeStore) GetUsersBasicRoles(ctx context.Context, userFilter []int64, orgID int64) (map[int64][]string, error) {
	return f.ExpectedUsersRoles, f.ExpectedErr
}

func (f FakeStore) DeleteUserPermissions(ctx context.Context, orgID, userID int64) error {
	return f.ExpectedErr
}

func (f FakeStore) SaveExternalServiceRole(ctx context.Context, cmd accesscontrol.SaveExternalServiceRoleCommand) error {
	return f.ExpectedErr
}

var _ accesscontrol.PermissionsService = new(FakePermissionsService)

type FakePermissionsService struct {
	ExpectedErr          error
	ExpectedPermission   *accesscontrol.ResourcePermission
	ExpectedPermissions  []accesscontrol.ResourcePermission
	ExpectedMappedAction string
}

func (f *FakePermissionsService) GetPermissions(ctx context.Context, user *user.SignedInUser, resourceID string) ([]accesscontrol.ResourcePermission, error) {
	return f.ExpectedPermissions, f.ExpectedErr
}

func (f *FakePermissionsService) SetUserPermission(ctx context.Context, orgID int64, user accesscontrol.User, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	return f.ExpectedPermission, f.ExpectedErr
}

func (f *FakePermissionsService) SetTeamPermission(ctx context.Context, orgID, teamID int64, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	return f.ExpectedPermission, f.ExpectedErr
}

func (f *FakePermissionsService) SetBuiltInRolePermission(ctx context.Context, orgID int64, builtInRole string, resourceID string, permission string) (*accesscontrol.ResourcePermission, error) {
	return f.ExpectedPermission, f.ExpectedErr
}

func (f *FakePermissionsService) SetPermissions(ctx context.Context, orgID int64, resourceID string, commands ...accesscontrol.SetResourcePermissionCommand) ([]accesscontrol.ResourcePermission, error) {
	return f.ExpectedPermissions, f.ExpectedErr
}

func (f *FakePermissionsService) MapActions(permission accesscontrol.ResourcePermission) string {
	return f.ExpectedMappedAction
}

package accesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type AccessControl interface {
	Evaluator
	Store
}

type Evaluator interface {
	// Evaluate evaluates access to the given resource
	Evaluate(ctx context.Context, user *models.SignedInUser, permission string, scope ...string) (bool, error)
}

type Store interface {
	// Database access methods
	GetRoles(ctx context.Context, orgID int64) ([]*Role, error)
	GetRole(ctx context.Context, orgID, roleID int64) (*RoleDTO, error)
	GetRoleByUID(ctx context.Context, orgId int64, uid string) (*RoleDTO, error)
	CreateRole(ctx context.Context, cmd CreateRoleCommand) (*Role, error)
	CreateRoleWithPermissions(ctx context.Context, cmd CreateRoleWithPermissionsCommand) (*RoleDTO, error)
	UpdateRole(ctx context.Context, cmd UpdateRoleCommand) (*RoleDTO, error)
	DeleteRole(cmd *DeleteRoleCommand) error
	GetRolePermissions(ctx context.Context, roleID int64) ([]Permission, error)
	CreatePermission(ctx context.Context, cmd CreatePermissionCommand) (*Permission, error)
	UpdatePermission(cmd *UpdatePermissionCommand) (*Permission, error)
	DeletePermission(ctx context.Context, cmd *DeletePermissionCommand) error
	GetTeamRoles(query *GetTeamRolesQuery) ([]*RoleDTO, error)
	GetUserRoles(ctx context.Context, query GetUserRolesQuery) ([]*RoleDTO, error)
	GetUserPermissions(ctx context.Context, query GetUserPermissionsQuery) ([]*Permission, error)
	AddTeamRole(cmd *AddTeamRoleCommand) error
	RemoveTeamRole(cmd *RemoveTeamRoleCommand) error
	AddUserRole(cmd *AddUserRoleCommand) error
	RemoveUserRole(cmd *RemoveUserRoleCommand) error
	AddBuiltinRole(ctx context.Context, orgID, roleID int64, roleName string) error
}

type Seeder interface {
	Seed(ctx context.Context, orgID int64) error
}

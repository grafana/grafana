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
	GetPolicies(ctx context.Context, orgID int64) ([]*Policy, error)
	GetPolicy(ctx context.Context, orgID, policyID int64) (*PolicyDTO, error)
	GetPolicyByUID(ctx context.Context, orgId int64, uid string) (*PolicyDTO, error)
	CreatePolicy(ctx context.Context, cmd CreatePolicyCommand) (*Policy, error)
	CreatePolicyWithPermissions(ctx context.Context, cmd CreatePolicyWithPermissionsCommand) (*PolicyDTO, error)
	UpdatePolicy(ctx context.Context, cmd UpdatePolicyCommand) (*PolicyDTO, error)
	DeletePolicy(cmd *DeletePolicyCommand) error
	GetPolicyPermissions(ctx context.Context, policyID int64) ([]Permission, error)
	CreatePermission(ctx context.Context, cmd CreatePermissionCommand) (*Permission, error)
	UpdatePermission(cmd *UpdatePermissionCommand) (*Permission, error)
	DeletePermission(ctx context.Context, cmd *DeletePermissionCommand) error
	GetTeamPolicies(query *GetTeamPoliciesQuery) ([]*PolicyDTO, error)
	GetUserPolicies(ctx context.Context, query GetUserPoliciesQuery) ([]*PolicyDTO, error)
	GetUserPermissions(ctx context.Context, query GetUserPermissionsQuery) ([]*Permission, error)
	AddTeamPolicy(cmd *AddTeamPolicyCommand) error
	RemoveTeamPolicy(cmd *RemoveTeamPolicyCommand) error
	AddUserPolicy(cmd *AddUserPolicyCommand) error
	RemoveUserPolicy(cmd *RemoveUserPolicyCommand) error
	AddBuiltinRolePolicy(ctx context.Context, orgID, policyID int64, role string) error
}

type Seeder interface {
	Seed(ctx context.Context, orgID int64) error
}

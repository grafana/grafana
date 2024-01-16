package user

import (
	"context"

	"github.com/grafana/grafana/pkg/registry"
)

type Service interface {
	registry.ProvidesUsageStats
	Create(context.Context, *CreateUserCommand) (*User, error)
	CreateServiceAccount(context.Context, *CreateUserCommand) (*User, error)
	Delete(context.Context, *DeleteUserCommand) error
	GetByID(context.Context, *GetUserByIDQuery) (*User, error)
	GetByLogin(context.Context, *GetUserByLoginQuery) (*User, error)
	GetByEmail(context.Context, *GetUserByEmailQuery) (*User, error)
	Update(context.Context, *UpdateUserCommand) error
	ChangePassword(context.Context, *ChangeUserPasswordCommand) error
	UpdateLastSeenAt(context.Context, *UpdateUserLastSeenAtCommand) error
	SetUsingOrg(context.Context, *SetUsingOrgCommand) error
	GetSignedInUserWithCacheCtx(context.Context, *GetSignedInUserQuery) (*SignedInUser, error)
	GetSignedInUser(context.Context, *GetSignedInUserQuery) (*SignedInUser, error)
	NewAnonymousSignedInUser(context.Context) (*SignedInUser, error)
	Search(context.Context, *SearchUsersQuery) (*SearchUserQueryResult, error)
	Disable(context.Context, *DisableUserCommand) error
	BatchDisableUsers(context.Context, *BatchDisableUsersCommand) error
	UpdatePermissions(context.Context, int64, bool) error
	SetUserHelpFlag(context.Context, *SetUserHelpFlagCommand) error
	GetProfile(context.Context, *GetUserProfileQuery) (*UserProfileDTO, error)
}

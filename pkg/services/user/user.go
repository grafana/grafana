package user

import (
	"context"

	"github.com/grafana/grafana/pkg/registry"
)

//go:generate mockery --name Service --structname MockService --outpkg usertest --filename mock.go --output ./usertest/
type Service interface {
	registry.ProvidesUsageStats
	Create(context.Context, *CreateUserCommand) (*User, error)
	CreateServiceAccount(context.Context, *CreateUserCommand) (*User, error)
	Delete(context.Context, *DeleteUserCommand) error
	GetByID(context.Context, *GetUserByIDQuery) (*User, error)
	GetByUID(context.Context, *GetUserByUIDQuery) (*User, error)
	GetByLogin(context.Context, *GetUserByLoginQuery) (*User, error)
	GetByEmail(context.Context, *GetUserByEmailQuery) (*User, error)
	List(context.Context, *ListUsersCommand) (*ListUserResult, error)
	Update(context.Context, *UpdateUserCommand) error
	UpdateLastSeenAt(context.Context, *UpdateUserLastSeenAtCommand) error
	GetSignedInUser(context.Context, *GetSignedInUserQuery) (*SignedInUser, error)
	Search(context.Context, *SearchUsersQuery) (*SearchUserQueryResult, error)
	BatchDisableUsers(context.Context, *BatchDisableUsersCommand) error
	GetProfile(context.Context, *GetUserProfileQuery) (*UserProfileDTO, error)
}

type Verifier interface {
	Start(ctx context.Context, cmd StartVerifyEmailCommand) error
	Complete(ctx context.Context, cmd CompleteEmailVerifyCommand) error
}

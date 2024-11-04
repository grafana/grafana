package user

import (
	"context"
	"strconv"

	"github.com/grafana/grafana/pkg/registry"
)

//go:generate mockery --name Service --structname MockService --outpkg usertest --filename mock.go --output ./usertest/
type Service interface {
	registry.ProvidesUsageStats
	Create(context.Context, *CreateUserCommand) (*User, error)
	CreateServiceAccount(context.Context, *CreateUserCommand) (*User, error)
	Delete(context.Context, *DeleteUserCommand) error
	GetByID(context.Context, *GetUserByIDQuery) (*User, error)
	// GetByUID returns a user by UID. This also includes service accounts (identity use only)
	GetByUID(context.Context, *GetUserByUIDQuery) (*User, error)
	GetByLogin(context.Context, *GetUserByLoginQuery) (*User, error)
	GetByEmail(context.Context, *GetUserByEmailQuery) (*User, error)
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

func UIDToIDHandler(userService Service) func(ctx context.Context, userID string) (string, error) {
	return func(ctx context.Context, userID string) (string, error) {
		_, err := strconv.ParseInt(userID, 10, 64)
		if userID == "" || err == nil {
			return userID, nil
		}
		user, err := userService.GetByUID(ctx, &GetUserByUIDQuery{
			UID: userID,
		})
		if err != nil {
			return "", err
		}

		return strconv.FormatInt(user.ID, 10), err
	}
}

package sync

import (
	"context"

	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
)

type UserProxy interface {
	GetByUserAuth(ctx context.Context, userAuth *login.UserAuth) (*user.User, error)
	GetByEmail(ctx context.Context, email string) (*user.User, error)
	GetByLogin(ctx context.Context, login string) (*user.User, error)
	GetSignedInUser(ctx context.Context, userID int64, orgID int64) (*user.SignedInUser, error)
	Create(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error)
	Update(ctx context.Context, cmd *user.UpdateUserCommand) error
	UpdateLastSeenAt(ctx context.Context, userID int64, orgID int64) error
}

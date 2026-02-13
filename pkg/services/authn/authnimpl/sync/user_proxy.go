package sync

import (
	"context"

	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
)

type UserProxy interface {
	GetByUserAuth(ctx context.Context, userAuth *login.UserAuth, orgID int64) (*user.User, error)
	GetByEmail(ctx context.Context, email string, orgID int64) (*user.User, error)
	GetByLogin(ctx context.Context, login string, orgID int64) (*user.User, error)
	GetSignedInUser(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error)
	Create(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error)
	Update(ctx context.Context, cmd *user.UpdateUserCommand) error
	UpdateLastSeenAt(ctx context.Context, cmd *user.UpdateUserLastSeenAtCommand) error
}

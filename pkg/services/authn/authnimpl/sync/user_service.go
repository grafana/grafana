package sync

import (
	"context"

	"github.com/grafana/grafana/pkg/services/user"
)

type UserService interface {
	GetByID(ctx context.Context, id int64) (*user.User, error)
	GetByEmail(ctx context.Context, namespace string, email string) (*user.User, error)
	GetByLogin(ctx context.Context, namespace string, login string) (*user.User, error)
	GetSignedInUser(ctx context.Context, namespace string, userUID string, orgID int64) (*user.SignedInUser, error)
	Create(ctx context.Context, namespace string, cmd *user.CreateUserCommand) (*user.User, error)
	Update(ctx context.Context, namespace string, userUID string, cmd *user.UpdateUserCommand) error
	UpdateLastSeenAt(ctx context.Context, namespace string, userUID string, orgID int64) error
}

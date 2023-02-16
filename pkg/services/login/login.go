package login

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/services/user"
)

var (
	ErrInvalidCredentials = errors.New("invalid username or password")
	ErrUsersQuotaReached  = errors.New("users quota reached")
	ErrGettingUserQuota   = errors.New("error getting user quota")
	ErrSignupNotAllowed   = errors.New("system administrator has disabled signup")
)

type TeamSyncFunc func(user *user.User, externalUser *ExternalUserInfo) error

type Service interface {
	UpsertUser(ctx context.Context, cmd *UpsertUserCommand) error
	DisableExternalUser(ctx context.Context, username string) error
	SetTeamSyncFunc(TeamSyncFunc)
}

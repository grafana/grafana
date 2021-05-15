package login

import (
	"errors"

	"github.com/grafana/grafana/pkg/models"
)

var (
	ErrInvalidCredentials = errors.New("invalid username or password")
	ErrUsersQuotaReached  = errors.New("users quota reached")
	ErrGettingUserQuota   = errors.New("error getting user quota")
)

type TeamSyncFunc func(user *models.User, externalUser *models.ExternalUserInfo) error

type Service interface {
	CreateUser(cmd models.CreateUserCommand) (*models.User, error)
	UpsertUser(cmd *models.UpsertUserCommand) error
	SetTeamSyncFunc(TeamSyncFunc)
}

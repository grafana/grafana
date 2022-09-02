package loginattempt

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type Service interface {
	CreateLoginAttempt(ctx context.Context, cmd *models.CreateLoginAttemptCommand) error
	DeleteOldLoginAttempts(ctx context.Context, cmd *models.DeleteOldLoginAttemptsCommand) error
	GetUserLoginAttemptCount(ctx context.Context, query *models.GetUserLoginAttemptCountQuery) error
}

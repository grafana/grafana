package login

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type AuthInfoService interface {
	LookupAndUpdate(ctx context.Context, query *models.GetUserByAuthInfoQuery) (*models.User, error)
}

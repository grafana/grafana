package serviceaccounts

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type Service interface {
	CreateServiceAccount(ctx context.Context, siUser *models.SignedInUser) error
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
}
type Store interface {
	CreateServiceAccount(ctx context.Context, siUser *models.SignedInUser) error
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
}

package serviceaccounts

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type Service interface {
	CreateServiceAccount(ctx context.Context, saForm *CreateServiceaccountForm) (*models.User, error)
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
}
type Store interface {
	CreateServiceAccount(ctx context.Context, saForm *CreateServiceaccountForm) (*models.User, error)
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
	UpgradeServiceAccounts(ctx context.Context) error
}

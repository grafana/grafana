package serviceaccounts

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type Service interface {
	HasServiceAccountsMigrated(ctx context.Context, orgID int64) bool
	CreateServiceAccount(ctx context.Context, saForm *CreateServiceaccountForm) (*models.User, error)
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
}
type Store interface {
	CreateServiceAccount(ctx context.Context, saForm *CreateServiceaccountForm) (*models.User, error)
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
	HasMigrated(ctx context.Context, orgID int64) (bool, error)
	UpgradeServiceAccounts(ctx context.Context) error
}

// create issue: for the refactoring of the service account api structure

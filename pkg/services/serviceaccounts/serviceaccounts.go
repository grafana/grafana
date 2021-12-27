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
	HasMigrated(ctx context.Context) (bool, error)
	UpgradeServiceAccounts(ctx context.Context, orgID int64) error
}

// TODO:
/*
- during a upgrade/migration of service accounts, we need to be able to disable/show loader the button on the frontend


- when we have migrated to service accounts, all checks should have a check for the feature toggle and the migration success
  - if not, we have to handle multiple states and might be confusing for us and the user
    and we might get inconsistent states in the application
*/

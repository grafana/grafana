package serviceaccounts

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

// this should reflect the api
type Service interface {
	CreateServiceAccount(ctx context.Context, orgID int64, name string) (*ServiceAccountDTO, error)
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
}

type Store interface {
	CreateServiceAccount(ctx context.Context, orgID int64, name string) (*ServiceAccountDTO, error)
	ListServiceAccounts(ctx context.Context, orgID, serviceAccountID int64) ([]*ServiceAccountDTO, error)
	SearchOrgServiceAccounts(ctx context.Context, query *models.SearchOrgUsersQuery) ([]*ServiceAccountDTO, error)
	UpdateServiceAccount(ctx context.Context, orgID, serviceAccountID int64, saForm *UpdateServiceAccountForm) (*ServiceAccountProfileDTO, error)
	RetrieveServiceAccount(ctx context.Context, orgID, serviceAccountID int64) (*ServiceAccountProfileDTO, error)
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
	UpgradeServiceAccounts(ctx context.Context) error
	ConvertToServiceAccounts(ctx context.Context, keys []int64) error
	ListTokens(ctx context.Context, orgID int64, serviceAccount int64) ([]*models.ApiKey, error)
	DeleteServiceAccountToken(ctx context.Context, orgID, serviceAccountID, tokenID int64) error
	AddServiceAccountToken(ctx context.Context, serviceAccountID int64, cmd *models.AddApiKeyCommand) error
}

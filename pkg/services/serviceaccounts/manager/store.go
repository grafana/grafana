package manager

import (
	"context"

	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

type store interface {
	AddServiceAccountToken(ctx context.Context, serviceAccountID int64, cmd *serviceaccounts.AddServiceAccountTokenCommand) (*apikey.APIKey, error)
	CreateServiceAccount(ctx context.Context, orgID int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error)
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
	DeleteServiceAccountToken(ctx context.Context, orgID, serviceAccountID, tokenID int64) error
	EnableServiceAccount(ctx context.Context, orgID, serviceAccountID int64, enable bool) error
	GetUsageMetrics(ctx context.Context) (*serviceaccounts.Stats, error)
	ListTokens(ctx context.Context, query *serviceaccounts.GetSATokensQuery) ([]apikey.APIKey, error)
	MigrateApiKeysToServiceAccounts(ctx context.Context, orgID int64) (*serviceaccounts.MigrationResult, error)
	RetrieveServiceAccount(ctx context.Context, query *serviceaccounts.GetServiceAccountQuery) (*serviceaccounts.ServiceAccountProfileDTO, error)
	RetrieveServiceAccountIdByName(ctx context.Context, orgID int64, name string) (int64, error)
	RevokeServiceAccountToken(ctx context.Context, orgId, serviceAccountId, tokenId int64) error
	SearchOrgServiceAccounts(ctx context.Context, query *serviceaccounts.SearchOrgServiceAccountsQuery) (*serviceaccounts.SearchOrgServiceAccountsResult, error)
	UpdateServiceAccount(ctx context.Context, orgID, serviceAccountID int64,
		saForm *serviceaccounts.UpdateServiceAccountForm) (*serviceaccounts.ServiceAccountProfileDTO, error)
}

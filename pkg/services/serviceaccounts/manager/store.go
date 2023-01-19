package manager

import (
	"context"

	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

/*
Store is the database store for service accounts.

migration from apikeys to service accounts:
HideApiKeyTab is used to hide the api key tab in the UI.
MigrateApiKeysToServiceAccounts migrates all API keys to service accounts.
MigrateApiKey migrates a single API key to a service account.

// only used for interal api calls
RevertApiKey reverts a single service account to an API key.
*/
type store interface {
	CreateServiceAccount(ctx context.Context, orgID int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error)
	SearchOrgServiceAccounts(ctx context.Context, query *serviceaccounts.SearchOrgServiceAccountsQuery) (*serviceaccounts.SearchOrgServiceAccountsResult, error)
	UpdateServiceAccount(ctx context.Context, orgID, serviceAccountID int64,
		saForm *serviceaccounts.UpdateServiceAccountForm) (*serviceaccounts.ServiceAccountProfileDTO, error)
	RetrieveServiceAccount(ctx context.Context, orgID, serviceAccountID int64) (*serviceaccounts.ServiceAccountProfileDTO, error)
	RetrieveServiceAccountIdByName(ctx context.Context, orgID int64, name string) (int64, error)
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
	GetAPIKeysMigrationStatus(ctx context.Context, orgID int64) (*serviceaccounts.APIKeysMigrationStatus, error)
	HideApiKeysTab(ctx context.Context, orgID int64) error
	MigrateApiKeysToServiceAccounts(ctx context.Context, orgID int64) error
	MigrateApiKey(ctx context.Context, orgID int64, keyId int64) error
	RevertApiKey(ctx context.Context, saId int64, keyId int64) error
	ListTokens(ctx context.Context, query *serviceaccounts.GetSATokensQuery) ([]apikey.APIKey, error)
	RevokeServiceAccountToken(ctx context.Context, orgId, serviceAccountId, tokenId int64) error
	AddServiceAccountToken(ctx context.Context, serviceAccountID int64, cmd *serviceaccounts.AddServiceAccountTokenCommand) error
	DeleteServiceAccountToken(ctx context.Context, orgID, serviceAccountID, tokenID int64) error
	GetUsageMetrics(ctx context.Context) (*serviceaccounts.Stats, error)
}

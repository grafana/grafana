package serviceaccounts

import (
	"context"

	"github.com/grafana/grafana/pkg/services/apikey"
)

/*
ServiceAccountService is the service that manages service accounts.

Service accounts are used to authenticate API requests. They are not users and
do not have a password.
*/

//go:generate mockery --name Service --structname MockServiceAccountService --output tests --outpkg tests --filename mocks.go
type Service interface {
	CreateServiceAccount(ctx context.Context, orgID int64, saForm *CreateServiceAccountForm) (*ServiceAccountDTO, error)
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
	RetrieveServiceAccount(ctx context.Context, orgID, serviceAccountID int64) (*ServiceAccountProfileDTO, error)
	RetrieveServiceAccountIdByName(ctx context.Context, orgID int64, name string) (int64, error)
	SearchOrgServiceAccounts(ctx context.Context, query *SearchOrgServiceAccountsQuery) (*SearchOrgServiceAccountsResult, error)
	EnableServiceAccount(ctx context.Context, orgID, serviceAccountID int64, enable bool) error
	UpdateServiceAccount(ctx context.Context, orgID, serviceAccountID int64,
		saForm *UpdateServiceAccountForm) (*ServiceAccountProfileDTO, error)

	// Tokens
	AddServiceAccountToken(ctx context.Context, serviceAccountID int64,
		cmd *AddServiceAccountTokenCommand) (*apikey.APIKey, error)
	DeleteServiceAccountToken(ctx context.Context, orgID, serviceAccountID, tokenID int64) error
	ListTokens(ctx context.Context, query *GetSATokensQuery) ([]apikey.APIKey, error)

	// API specific functions
	MigrateApiKey(ctx context.Context, orgID int64, keyId int64) error
	MigrateApiKeysToServiceAccounts(ctx context.Context, orgID int64) (*MigrationResult, error)
}

//go:generate mockery --name ExtSvcAccountsService --structname MockExtSvcAccountsService --output tests --outpkg tests --filename extsvcaccmock.go
type ExtSvcAccountsService interface {
	// EnableExtSvcAccount enables or disables the service account associated to an external service
	EnableExtSvcAccount(ctx context.Context, cmd *EnableExtSvcAccountCmd) error
	// ManageExtSvcAccount creates, updates or deletes the service account associated with an external service
	ManageExtSvcAccount(ctx context.Context, cmd *ManageExtSvcAccountCmd) (int64, error)
	// RemoveExtSvcAccount removes the external service account associated with an external service
	RemoveExtSvcAccount(ctx context.Context, orgID int64, extSvcSlug string) error
	// RetrieveExtSvcAccount fetches an external service account by ID
	RetrieveExtSvcAccount(ctx context.Context, orgID, saID int64) (*ExtSvcAccount, error)
}

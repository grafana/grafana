package serviceaccounttest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

// Service implements the API exposed methods for service accounts.
type service interface {
	CreateServiceAccount(ctx context.Context, orgID int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error)
	RetrieveServiceAccount(ctx context.Context, orgID, serviceAccountID int64) (*serviceaccounts.ServiceAccountProfileDTO, error)
	RetrieveServiceAccountIdByName(ctx context.Context, orgID int64, name string) (int64, error)
	UpdateServiceAccount(ctx context.Context, orgID, serviceAccountID int64,
		saForm *serviceaccounts.UpdateServiceAccountForm) (*serviceaccounts.ServiceAccountProfileDTO, error)
	SearchOrgServiceAccounts(ctx context.Context, query *serviceaccounts.SearchOrgServiceAccountsQuery) (*serviceaccounts.SearchOrgServiceAccountsResult, error)
	ListTokens(ctx context.Context, query *serviceaccounts.GetSATokensQuery) ([]apikey.APIKey, error)
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
	GetAPIKeysMigrationStatus(ctx context.Context, orgID int64) (*serviceaccounts.APIKeysMigrationStatus, error)
	HideApiKeysTab(ctx context.Context, orgID int64) error
	MigrateApiKeysToServiceAccounts(ctx context.Context, orgID int64) error
	MigrateApiKey(ctx context.Context, orgID int64, keyId int64) error
	RevertApiKey(ctx context.Context, saId int64, keyId int64) error
	// Service account tokens
	AddServiceAccountToken(ctx context.Context, serviceAccountID int64, cmd *serviceaccounts.AddServiceAccountTokenCommand) (*apikey.APIKey, error)
	DeleteServiceAccountToken(ctx context.Context, orgID, serviceAccountID, tokenID int64) error

	CheckGloballyHideAPIKeysTab(ctx context.Context) bool
}

var _ service = new(FakeServiceAccountService)

type FakeServiceAccountService struct {
	service
	ExpectedErr                   error
	ExpectedBool                  bool
	ExpectedID                    int64
	ExpectedAPIKey                *apikey.APIKey
	ExpectedServiceAccountTokens  []apikey.APIKey
	ExpectedServiceAccount        *serviceaccounts.ServiceAccountDTO
	ExpectedServiceAccountProfile *serviceaccounts.ServiceAccountProfileDTO
}

func (f *FakeServiceAccountService) CreateServiceAccount(ctx context.Context, orgID int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error) {
	return f.ExpectedServiceAccount, f.ExpectedErr
}

func (f *FakeServiceAccountService) DeleteServiceAccount(ctx context.Context, orgID, id int64) error {
	return f.ExpectedErr
}

func (f *FakeServiceAccountService) RetrieveServiceAccount(ctx context.Context, orgID, id int64) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	return f.ExpectedServiceAccountProfile, f.ExpectedErr
}

func (f *FakeServiceAccountService) RetrieveServiceAccountIdByName(ctx context.Context, orgID int64, name string) (int64, error) {
	return f.ExpectedID, f.ExpectedErr
}

func (f *FakeServiceAccountService) ListTokens(ctx context.Context, query *serviceaccounts.GetSATokensQuery) ([]apikey.APIKey, error) {
	return f.ExpectedServiceAccountTokens, f.ExpectedErr
}

func (f *FakeServiceAccountService) UpdateServiceAccount(ctx context.Context, orgID, id int64, cmd *serviceaccounts.UpdateServiceAccountForm) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	return f.ExpectedServiceAccountProfile, f.ExpectedErr
}

func (f *FakeServiceAccountService) AddServiceAccountToken(ctx context.Context, id int64, cmd *serviceaccounts.AddServiceAccountTokenCommand) (*apikey.APIKey, error) {
	return f.ExpectedAPIKey, f.ExpectedErr
}

func (f *FakeServiceAccountService) DeleteServiceAccountToken(ctx context.Context, orgID, id, tokenID int64) error {
	return f.ExpectedErr
}

func (f *FakeServiceAccountService) CheckGloballyHideAPIKeysTab(ctx context.Context) bool {
	return f.ExpectedBool
}

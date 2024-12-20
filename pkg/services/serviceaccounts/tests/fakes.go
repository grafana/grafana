package tests

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

type FakeServiceAccountService struct {
	ExpectedAPIKey                         *apikey.APIKey
	ExpectedErr                            error
	ExpectedMigrationResult                *serviceaccounts.MigrationResult
	ExpectedSearchOrgServiceAccountsResult *serviceaccounts.SearchOrgServiceAccountsResult
	ExpectedServiceAccount                 *serviceaccounts.ServiceAccountDTO
	ExpectedServiceAccountID               int64
	ExpectedServiceAccountProfile          *serviceaccounts.ServiceAccountProfileDTO
	ExpectedServiceAccountTokens           []apikey.APIKey
}

var _ serviceaccounts.Service = new(FakeServiceAccountService)

func (f *FakeServiceAccountService) AddServiceAccountToken(ctx context.Context, id int64, cmd *serviceaccounts.AddServiceAccountTokenCommand) (*apikey.APIKey, error) {
	return f.ExpectedAPIKey, f.ExpectedErr
}

func (f *FakeServiceAccountService) CreateServiceAccount(ctx context.Context, orgID int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error) {
	return f.ExpectedServiceAccount, f.ExpectedErr
}

func (f *FakeServiceAccountService) DeleteServiceAccount(ctx context.Context, orgID, id int64) error {
	return f.ExpectedErr
}

func (f *FakeServiceAccountService) EnableServiceAccount(ctx context.Context, orgID int64, serviceAccountID int64, enable bool) error {
	return f.ExpectedErr
}

func (f *FakeServiceAccountService) RetrieveServiceAccount(ctx context.Context, query *serviceaccounts.GetServiceAccountQuery) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	return f.ExpectedServiceAccountProfile, f.ExpectedErr
}

func (f *FakeServiceAccountService) RetrieveServiceAccountIdByName(ctx context.Context, orgID int64, name string) (int64, error) {
	return f.ExpectedServiceAccountID, f.ExpectedErr
}

func (f *FakeServiceAccountService) UpdateServiceAccount(ctx context.Context, orgID, id int64, cmd *serviceaccounts.UpdateServiceAccountForm) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	return f.ExpectedServiceAccountProfile, f.ExpectedErr
}

func (f *FakeServiceAccountService) ListTokens(ctx context.Context, query *serviceaccounts.GetSATokensQuery) ([]apikey.APIKey, error) {
	return f.ExpectedServiceAccountTokens, f.ExpectedErr
}

func (f *FakeServiceAccountService) MigrateApiKey(ctx context.Context, orgID, keyID int64) error {
	return f.ExpectedErr
}

func (f *FakeServiceAccountService) MigrateApiKeysToServiceAccounts(ctx context.Context, orgID int64) (*serviceaccounts.MigrationResult, error) {
	fmt.Printf("fake migration result: %v", f.ExpectedMigrationResult)
	return f.ExpectedMigrationResult, f.ExpectedErr
}

func (f *FakeServiceAccountService) SearchOrgServiceAccounts(ctx context.Context, query *serviceaccounts.SearchOrgServiceAccountsQuery) (*serviceaccounts.SearchOrgServiceAccountsResult, error) {
	return f.ExpectedSearchOrgServiceAccountsResult, f.ExpectedErr
}

// Service account tokens

func (f *FakeServiceAccountService) DeleteServiceAccountToken(ctx context.Context, orgID, id, tokenID int64) error {
	return f.ExpectedErr
}

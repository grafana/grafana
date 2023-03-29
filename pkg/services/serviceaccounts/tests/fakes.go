package tests

import (
	"context"

	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

var _ serviceaccounts.Service = &FakeServiceAccountService{}

type FakeServiceAccountService struct {
	ExpectedApiKey                   *apikey.APIKey
	ExpectedServiceAccountDTO        *serviceaccounts.ServiceAccountDTO
	ExpectedServiceAccountProfileDTO *serviceaccounts.ServiceAccountProfileDTO
	ExpectedServiceAccountId         int64
	ExpectedErr                      error
}

// AddServiceAccountToken implements serviceaccounts.Service
func (fs *FakeServiceAccountService) AddServiceAccountToken(ctx context.Context, serviceAccountID int64, cmd *serviceaccounts.AddServiceAccountTokenCommand) (*apikey.APIKey, error) {
	return fs.ExpectedApiKey, fs.ExpectedErr
}

// CreateServiceAccount implements serviceaccounts.Service
func (fs *FakeServiceAccountService) CreateServiceAccount(ctx context.Context, orgID int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error) {
	return fs.ExpectedServiceAccountDTO, fs.ExpectedErr
}

// DeleteServiceAccount implements serviceaccounts.Service
func (fs *FakeServiceAccountService) DeleteServiceAccount(ctx context.Context, orgID int64, serviceAccountID int64) error {
	return fs.ExpectedErr
}

// RetrieveServiceAccount implements serviceaccounts.Service
func (fs *FakeServiceAccountService) RetrieveServiceAccount(ctx context.Context, orgID int64, serviceAccountID int64) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	return fs.ExpectedServiceAccountProfileDTO, fs.ExpectedErr
}

// RetrieveServiceAccountIdByName implements serviceaccounts.Service
func (fs *FakeServiceAccountService) RetrieveServiceAccountIdByName(ctx context.Context, orgID int64, name string) (int64, error) {
	return fs.ExpectedServiceAccountId, fs.ExpectedErr
}

// UpdateServiceAccount implements serviceaccounts.Service
func (fs *FakeServiceAccountService) UpdateServiceAccount(ctx context.Context, orgID int64, serviceAccountID int64, saForm *serviceaccounts.UpdateServiceAccountForm) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	return fs.ExpectedServiceAccountProfileDTO, fs.ExpectedErr
}

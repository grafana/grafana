package tests

import (
	"context"

	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

var _ serviceaccounts.Service = &MockServiceAccountService{}

type MockServiceAccountService struct {
	mock.Mock
}

// AddServiceAccountToken implements serviceaccounts.Service
func (s *MockServiceAccountService) AddServiceAccountToken(ctx context.Context, serviceAccountID int64, cmd *serviceaccounts.AddServiceAccountTokenCommand) (*apikey.APIKey, error) {
	mockedArgs := s.Called(ctx, serviceAccountID, cmd)
	return mockedArgs.Get(0).(*apikey.APIKey), mockedArgs.Error(1)
}

// CreateServiceAccount implements serviceaccounts.Service
func (s *MockServiceAccountService) CreateServiceAccount(ctx context.Context, orgID int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error) {
	mockedArgs := s.Called(ctx, orgID, saForm)
	return mockedArgs.Get(0).(*serviceaccounts.ServiceAccountDTO), mockedArgs.Error(1)
}

// DeleteServiceAccount implements serviceaccounts.Service
func (s *MockServiceAccountService) DeleteServiceAccount(ctx context.Context, orgID int64, serviceAccountID int64) error {
	mockedArgs := s.Called(ctx, orgID, serviceAccountID)
	return mockedArgs.Error(0)
}

// RetrieveServiceAccount implements serviceaccounts.Service
func (s *MockServiceAccountService) RetrieveServiceAccount(ctx context.Context, orgID int64, serviceAccountID int64) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	mockedArgs := s.Called(ctx, orgID, serviceAccountID)
	return mockedArgs.Get(0).(*serviceaccounts.ServiceAccountProfileDTO), mockedArgs.Error(1)
}

// RetrieveServiceAccountIdByName implements serviceaccounts.Service
func (s *MockServiceAccountService) RetrieveServiceAccountIdByName(ctx context.Context, orgID int64, name string) (int64, error) {
	mockedArgs := s.Called(ctx, orgID, name)
	return mockedArgs.Get(0).(int64), mockedArgs.Error(1)
}

// UpdateServiceAccount implements serviceaccounts.Service
func (s *MockServiceAccountService) UpdateServiceAccount(ctx context.Context, orgID int64, serviceAccountID int64, saForm *serviceaccounts.UpdateServiceAccountForm) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	mockedArgs := s.Called(ctx, orgID, serviceAccountID)
	return mockedArgs.Get(0).(*serviceaccounts.ServiceAccountProfileDTO), mockedArgs.Error(1)
}

package manager

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

type FakeServiceAccountStore struct {
	ExpectedServiceAccountID                *serviceaccounts.ServiceAccount
	ExpectedServiceAccountDTO               *serviceaccounts.ServiceAccountDTO
	ExpectedServiceAccountProfileDTO        *serviceaccounts.ServiceAccountProfileDTO
	ExpectedSearchServiceAccountQueryResult *serviceaccounts.SearchOrgServiceAccountsResult
	ExpectedStats                           *serviceaccounts.Stats
	expectedMigratedResults                 *serviceaccounts.MigrationResult
	ExpectedAPIKeys                         []apikey.APIKey
	ExpectedAPIKey                          *apikey.APIKey
	ExpectedBoolean                         bool
	ExpectedError                           error
}

func newServiceAccountStoreFake() *FakeServiceAccountStore {
	return &FakeServiceAccountStore{}
}

// CreateServiceAccount is a fake creating a service account.
func (f *FakeServiceAccountStore) RetrieveServiceAccount(ctx context.Context, orgID, serviceAccountID int64) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	return f.ExpectedServiceAccountProfileDTO, f.ExpectedError
}

// RetrieveServiceAccountIdByName is a fake retrieving a service account id by name.
func (f *FakeServiceAccountStore) RetrieveServiceAccountIdByName(ctx context.Context, orgID int64, name string) (int64, error) {
	return f.ExpectedServiceAccountID.Id, f.ExpectedError
}

// CreateServiceAccount is a fake creating a service account.
func (f *FakeServiceAccountStore) CreateServiceAccount(ctx context.Context, orgID int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error) {
	return f.ExpectedServiceAccountDTO, f.ExpectedError
}

// SearchOrgServiceAccounts is a fake searching for service accounts.
func (f *FakeServiceAccountStore) SearchOrgServiceAccounts(ctx context.Context, query *serviceaccounts.SearchOrgServiceAccountsQuery) (*serviceaccounts.SearchOrgServiceAccountsResult, error) {
	return f.ExpectedSearchServiceAccountQueryResult, f.ExpectedError
}

// UpdateServiceAccount is a fake updating a service account.
func (f *FakeServiceAccountStore) UpdateServiceAccount(ctx context.Context, orgID, serviceAccountID int64,
	saForm *serviceaccounts.UpdateServiceAccountForm) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	return f.ExpectedServiceAccountProfileDTO, f.ExpectedError
}

// DeleteServiceAccount is a fake deleting a service account.
func (f *FakeServiceAccountStore) DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error {
	return f.ExpectedError
}

// MigrateApiKeysToServiceAccounts is a fake migrating api keys to service accounts.
func (f *FakeServiceAccountStore) MigrateApiKeysToServiceAccounts(ctx context.Context, orgID int64) (*serviceaccounts.MigrationResult, error) {
	return f.expectedMigratedResults, f.ExpectedError
}

// MigrateApiKey is a fake migrating an api key to a service account.
func (f *FakeServiceAccountStore) MigrateApiKey(ctx context.Context, orgID int64, keyId int64) error {
	return f.ExpectedError
}

// RevertApiKey is a fake reverting an api key to a service account.
func (f *FakeServiceAccountStore) RevertApiKey(ctx context.Context, saId int64, keyId int64) error {
	return f.ExpectedError
}

// ListTokens is a fake listing tokens.
func (f *FakeServiceAccountStore) ListTokens(ctx context.Context, query *serviceaccounts.GetSATokensQuery) ([]apikey.APIKey, error) {
	return f.ExpectedAPIKeys, f.ExpectedError
}

// RevokeServiceAccountToken is a fake revoking a service account token.
func (f *FakeServiceAccountStore) RevokeServiceAccountToken(ctx context.Context, orgId, serviceAccountId, tokenId int64) error {
	return f.ExpectedError
}

// AddServiceAccountToken is a fake adding a service account token.
func (f *FakeServiceAccountStore) AddServiceAccountToken(ctx context.Context, serviceAccountID int64, cmd *serviceaccounts.AddServiceAccountTokenCommand) (*apikey.APIKey, error) {
	return f.ExpectedAPIKey, f.ExpectedError
}

// DeleteServiceAccountToken is a fake deleting a service account token.
func (f *FakeServiceAccountStore) DeleteServiceAccountToken(ctx context.Context, orgID, serviceAccountID, tokenID int64) error {
	return f.ExpectedError
}

// GetUsageMetrics is a fake getting usage metrics.
func (f *FakeServiceAccountStore) GetUsageMetrics(ctx context.Context) (*serviceaccounts.Stats, error) {
	return f.ExpectedStats, f.ExpectedError
}

type SecretsCheckerFake struct {
	ExpectedError error
}

func (f *SecretsCheckerFake) CheckTokens(ctx context.Context) error {
	return f.ExpectedError
}

func TestProvideServiceAccount_DeleteServiceAccount(t *testing.T) {
	storeMock := newServiceAccountStoreFake()
	svc := ServiceAccountsService{storeMock, log.New("test"), log.New("background.test"), &SecretsCheckerFake{}, false, 0}
	testOrgId := 1

	t.Run("should create service account", func(t *testing.T) {
		serviceAccountName := "new Service Account"
		serviceAccountRole := org.RoleAdmin
		isDisabled := true
		saForm := &serviceaccounts.CreateServiceAccountForm{
			Name:       serviceAccountName,
			Role:       &serviceAccountRole,
			IsDisabled: &isDisabled,
		}
		storeMock.ExpectedServiceAccountDTO = &serviceaccounts.ServiceAccountDTO{
			Id:         1,
			Name:       serviceAccountName,
			Role:       string(serviceAccountRole),
			IsDisabled: isDisabled,
		}
		_, err := svc.CreateServiceAccount(context.Background(), int64(testOrgId), saForm)
		require.NoError(t, err)
	})

	t.Run("should delete service account", func(t *testing.T) {
		err := svc.DeleteServiceAccount(context.Background(), int64(testOrgId), 1)
		require.NoError(t, err)
	})
}

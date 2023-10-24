package proxy

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/extsvcaccounts"
	"github.com/stretchr/testify/assert"
)

type FakeServiceAccountsService struct {
	ExpectedServiceAccountProfileDTO *serviceaccounts.ServiceAccountProfileDTO
}

var _ serviceaccounts.Service = (*FakeServiceAccountsService)(nil)

func newServiceAccountServiceFake() *FakeServiceAccountsService {
	return &FakeServiceAccountsService{}
}

func (f *FakeServiceAccountsService) CreateServiceAccount(ctx context.Context, orgID int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error) {
	return nil, nil
}

func (f *FakeServiceAccountsService) DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error {
	return nil
}

func (f *FakeServiceAccountsService) RetrieveServiceAccount(ctx context.Context, orgID, serviceAccountID int64) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	return f.ExpectedServiceAccountProfileDTO, nil
}

func (f *FakeServiceAccountsService) RetrieveServiceAccountIdByName(ctx context.Context, orgID int64, name string) (int64, error) {
	return 0, nil
}

func (f *FakeServiceAccountsService) UpdateServiceAccount(ctx context.Context, orgID, serviceAccountID int64,
	saForm *serviceaccounts.UpdateServiceAccountForm) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	return nil, nil
}

func (f *FakeServiceAccountsService) AddServiceAccountToken(ctx context.Context, serviceAccountID int64,
	cmd *serviceaccounts.AddServiceAccountTokenCommand) (*apikey.APIKey, error) {
	return nil, nil
}

func TestProvideServiceAccount_DeleteServiceAccount(t *testing.T) {
	testOrgId := int64(1)
	testServiceAccountId := int64(1)
	serviceMock := newServiceAccountServiceFake()
	svc := ServiceAccountsProxy{
		log.New("test"),
		serviceMock,
	}

	t.Run("should create service account", func(t *testing.T) {
		testCases := []struct {
			description   string
			form          serviceaccounts.CreateServiceAccountForm
			expectedError error
		}{
			{
				description: "should create service account and not return error",
				form: serviceaccounts.CreateServiceAccountForm{
					Name: "my-service-account",
				},
				expectedError: nil,
			},
			{
				description: "should not allow to create a service account with extsvc prefix",
				form: serviceaccounts.CreateServiceAccountForm{
					Name: "extsvc-my-service-account",
				},
				expectedError: extsvcaccounts.ErrInvalidName,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.description, func(t *testing.T) {
				tc := tc
				_, err := svc.CreateServiceAccount(context.Background(), testOrgId, &tc.form)
				assert.Equal(t, err, tc.expectedError, tc.description)
			})
		}
	})

	t.Run("should delete service account", func(t *testing.T) {
		testCases := []struct {
			description            string
			expectedError          error
			expectedServiceAccount *serviceaccounts.ServiceAccountProfileDTO
		}{
			{
				description:   "should allow to delete a service account",
				expectedError: nil,
				expectedServiceAccount: &serviceaccounts.ServiceAccountProfileDTO{
					Login: "my-service-account",
				},
			},
			{
				description:   "should not allow to delete a service account with sa-extsvc prefix",
				expectedError: extsvcaccounts.ErrCannotBeDeleted,
				expectedServiceAccount: &serviceaccounts.ServiceAccountProfileDTO{
					Login: "sa-extsvc-my-service-account",
				},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.description, func(t *testing.T) {
				serviceMock.ExpectedServiceAccountProfileDTO = tc.expectedServiceAccount
				err := svc.DeleteServiceAccount(context.Background(), testOrgId, testServiceAccountId)
				assert.Equal(t, err, tc.expectedError, tc.description)
			})
		}
	})

	t.Run("should retrieve service account with IsExternal field", func(t *testing.T) {
		testCases := []struct {
			description            string
			expectedServiceAccount *serviceaccounts.ServiceAccountProfileDTO
			expectedIsExternal     bool
		}{
			{
				description: "should not mark as external",
				expectedServiceAccount: &serviceaccounts.ServiceAccountProfileDTO{
					Login: "my-service-account",
				},
				expectedIsExternal: false,
			},
			{
				description: "should mark as external",
				expectedServiceAccount: &serviceaccounts.ServiceAccountProfileDTO{
					Login: "sa-extsvc-my-service-account",
				},
				expectedIsExternal: true,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.description, func(t *testing.T) {
				serviceMock.ExpectedServiceAccountProfileDTO = tc.expectedServiceAccount
				sa, err := svc.RetrieveServiceAccount(context.Background(), testOrgId, testServiceAccountId)
				assert.NoError(t, err, tc.description)
				assert.Equal(t, tc.expectedIsExternal, sa.IsExternal, tc.description)
			})
		}
	})

	t.Run("should update service account", func(t *testing.T) {
		nameWithoutProtectedPrefix := "my-updated-service-account"
		nameWithProtectedPrefix := "extsvc-my-updated-service-account"
		testCases := []struct {
			description            string
			form                   serviceaccounts.UpdateServiceAccountForm
			expectedServiceAccount *serviceaccounts.ServiceAccountProfileDTO
			expectedError          error
		}{
			{
				description: "should update a non-external service account with a valid name",
				form: serviceaccounts.UpdateServiceAccountForm{
					Name: &nameWithoutProtectedPrefix,
				},
				expectedServiceAccount: &serviceaccounts.ServiceAccountProfileDTO{
					Login: "my-service-account",
				},
				expectedError: nil,
			},
			{
				description: "should not allow to update a non-external service account with extsvc prefix",
				form: serviceaccounts.UpdateServiceAccountForm{
					Name: &nameWithProtectedPrefix,
				},
				expectedServiceAccount: &serviceaccounts.ServiceAccountProfileDTO{
					Login: "my-service-account",
				},
				expectedError: extsvcaccounts.ErrInvalidName,
			},
			{
				description: "should not allow to update an external service account with a valid name",
				form: serviceaccounts.UpdateServiceAccountForm{
					Name: &nameWithoutProtectedPrefix,
				},
				expectedServiceAccount: &serviceaccounts.ServiceAccountProfileDTO{
					Login: "sa-extsvc-my-service-account",
				},
				expectedError: extsvcaccounts.ErrCannotBeUpdated,
			},
			{
				description: "should not allow to update an external service account with a extsvc prefix",
				form: serviceaccounts.UpdateServiceAccountForm{
					Name: &nameWithProtectedPrefix,
				},
				expectedServiceAccount: &serviceaccounts.ServiceAccountProfileDTO{
					Login: "sa-extsvc-my-service-account",
				},
				expectedError: extsvcaccounts.ErrInvalidName,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.description, func(t *testing.T) {
				tc := tc
				serviceMock.ExpectedServiceAccountProfileDTO = tc.expectedServiceAccount
				_, err := svc.UpdateServiceAccount(context.Background(), testOrgId, testServiceAccountId, &tc.form)
				assert.Equal(t, tc.expectedError, err, tc.description)
			})
		}
	})

	t.Run("should add service account tokens", func(t *testing.T) {
		testCases := []struct {
			description            string
			cmd                    serviceaccounts.AddServiceAccountTokenCommand
			expectedServiceAccount *serviceaccounts.ServiceAccountProfileDTO
			expectedError          error
		}{
			{
				description: "should allow to create a service account token",
				cmd: serviceaccounts.AddServiceAccountTokenCommand{
					OrgId: testOrgId,
				},
				expectedServiceAccount: &serviceaccounts.ServiceAccountProfileDTO{
					Login: "my-service-account",
				},
				expectedError: nil,
			},
			{
				description: "should not allow to create a service account token",
				cmd: serviceaccounts.AddServiceAccountTokenCommand{
					OrgId: testOrgId,
				},
				expectedServiceAccount: &serviceaccounts.ServiceAccountProfileDTO{
					Login: "sa-extsvc-my-service-account",
				},
				expectedError: extsvcaccounts.ErrCannotCreateToken,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.description, func(t *testing.T) {
				tc := tc
				serviceMock.ExpectedServiceAccountProfileDTO = tc.expectedServiceAccount
				_, err := svc.AddServiceAccountToken(context.Background(), testServiceAccountId, &tc.cmd)
				assert.Equal(t, tc.expectedError, err, tc.description)
			})
		}
	})

	t.Run("should identify service account logins for being external or not", func(t *testing.T) {
		assert.False(t, isExternalServiceAccount("my-service-account"))
		assert.False(t, isExternalServiceAccount("sa-my-service-account"))
		assert.False(t, isExternalServiceAccount("extsvc-my-service-account"))
		assert.True(t, isExternalServiceAccount("sa-extsvc-my-service-account"))
	})
}

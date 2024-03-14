package proxy

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/extsvcaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
)

var _ serviceaccounts.Service = (*tests.FakeServiceAccountService)(nil)

func TestProvideServiceAccount_crudServiceAccount(t *testing.T) {
	testOrgId := int64(1)
	testServiceAccountId := int64(1)
	testServiceAccountTokenId := int64(1)
	serviceMock := &tests.FakeServiceAccountService{}
	svc := ServiceAccountsProxy{
		log.New("test"),
		serviceMock,
		true,
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
				serviceMock.ExpectedServiceAccountProfile = tc.expectedServiceAccount
				err := svc.DeleteServiceAccount(context.Background(), testOrgId, testServiceAccountId)
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
				description:   "should allow to delete a service account token",
				expectedError: nil,
				expectedServiceAccount: &serviceaccounts.ServiceAccountProfileDTO{
					Login: "my-service-account",
				},
			},
			{
				description:   "should not allow to delete a external service account token",
				expectedError: extsvcaccounts.ErrCannotDeleteToken,
				expectedServiceAccount: &serviceaccounts.ServiceAccountProfileDTO{
					Login: "sa-extsvc-my-service-account",
				},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.description, func(t *testing.T) {
				serviceMock.ExpectedServiceAccountProfile = tc.expectedServiceAccount
				err := svc.DeleteServiceAccountToken(context.Background(), testOrgId, testServiceAccountId, testServiceAccountTokenId)
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
				serviceMock.ExpectedServiceAccountProfile = tc.expectedServiceAccount
				sa, err := svc.RetrieveServiceAccount(context.Background(), testOrgId, testServiceAccountId)
				assert.NoError(t, err, tc.description)
				assert.Equal(t, tc.expectedIsExternal, sa.IsExternal, tc.description)
			})
		}
	})

	t.Run("should mark external service accounts correctly", func(t *testing.T) {
		serviceMock.ExpectedSearchOrgServiceAccountsResult = &serviceaccounts.SearchOrgServiceAccountsResult{
			TotalCount: 2,
			ServiceAccounts: []*serviceaccounts.ServiceAccountDTO{
				{Login: "test"},
				{Login: serviceaccounts.ExtSvcLoginPrefix + "test"},
			},
			Page:    1,
			PerPage: 2,
		}
		res, err := svc.SearchOrgServiceAccounts(context.Background(), &serviceaccounts.SearchOrgServiceAccountsQuery{OrgID: 1})
		require.Len(t, res.ServiceAccounts, 2)
		require.NoError(t, err)
		require.False(t, res.ServiceAccounts[0].IsExternal)
		require.True(t, res.ServiceAccounts[1].IsExternal)
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
				serviceMock.ExpectedServiceAccountProfile = tc.expectedServiceAccount
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
				serviceMock.ExpectedServiceAccountProfile = tc.expectedServiceAccount
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

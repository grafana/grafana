package proxy

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	sa "github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/extsvcaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
)

var (
	_ sa.Service = (*tests.FakeServiceAccountService)(nil)

	autoAssignOrgID = int64(2)
)

func TestProvideServiceAccount_crudServiceAccount(t *testing.T) {
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
			form          sa.CreateServiceAccountForm
			expectedError error
		}{
			{
				description: "should create service account and not return error",
				form: sa.CreateServiceAccountForm{
					Name: "my-service-account",
				},
				expectedError: nil,
			},
			{
				description: "should not allow to create a service account with extsvc- prefix",
				form: sa.CreateServiceAccountForm{
					Name: "extsvc-my-service-account",
				},
				expectedError: extsvcaccounts.ErrInvalidName,
			},
			{
				description: "should not allow to create a service account with extsvc prefix",
				form: sa.CreateServiceAccountForm{
					Name: "extsvc my-service-account",
				},
				expectedError: extsvcaccounts.ErrInvalidName,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.description, func(t *testing.T) {
				tc := tc
				_, err := svc.CreateServiceAccount(context.Background(), autoAssignOrgID, &tc.form)
				assert.Equal(t, err, tc.expectedError, tc.description)
			})
		}
	})

	t.Run("should delete service account", func(t *testing.T) {
		testCases := []struct {
			description            string
			expectedError          error
			expectedServiceAccount *sa.ServiceAccountProfileDTO
		}{
			{
				description:   "should allow to delete a service account",
				expectedError: nil,
				expectedServiceAccount: &sa.ServiceAccountProfileDTO{
					Login: "my-service-account",
				},
			},
			{
				description:   "should not allow to delete a service account with " + sa.ExtSvcLoginPrefix(autoAssignOrgID) + " prefix",
				expectedError: extsvcaccounts.ErrCannotBeDeleted,
				expectedServiceAccount: &sa.ServiceAccountProfileDTO{
					Login: sa.ExtSvcLoginPrefix(autoAssignOrgID) + "my-service-account",
				},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.description, func(t *testing.T) {
				serviceMock.ExpectedServiceAccountProfile = tc.expectedServiceAccount
				err := svc.DeleteServiceAccount(context.Background(), autoAssignOrgID, testServiceAccountId)
				assert.Equal(t, err, tc.expectedError, tc.description)
			})
		}
	})

	t.Run("should delete service account token", func(t *testing.T) {
		testCases := []struct {
			description            string
			expectedError          error
			expectedServiceAccount *sa.ServiceAccountProfileDTO
		}{
			{
				description:   "should allow to delete a service account token",
				expectedError: nil,
				expectedServiceAccount: &sa.ServiceAccountProfileDTO{
					Login: "my-service-account",
				},
			},
			{
				description:   "should not allow to delete a external service account token",
				expectedError: extsvcaccounts.ErrCannotDeleteToken,
				expectedServiceAccount: &sa.ServiceAccountProfileDTO{
					Login: sa.ExtSvcLoginPrefix(autoAssignOrgID) + "my-service-account",
				},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.description, func(t *testing.T) {
				serviceMock.ExpectedServiceAccountProfile = tc.expectedServiceAccount
				err := svc.DeleteServiceAccountToken(context.Background(), autoAssignOrgID, testServiceAccountId, testServiceAccountTokenId)
				assert.Equal(t, err, tc.expectedError, tc.description)
			})
		}
	})

	t.Run("should retrieve service account with IsExternal field", func(t *testing.T) {
		testCases := []struct {
			description            string
			expectedServiceAccount *sa.ServiceAccountProfileDTO
			expectedIsExternal     bool
		}{
			{
				description: "should not mark as external",
				expectedServiceAccount: &sa.ServiceAccountProfileDTO{
					Login: "my-service-account",
				},
				expectedIsExternal: false,
			},
			{
				description: "should mark as external",
				expectedServiceAccount: &sa.ServiceAccountProfileDTO{
					Login: sa.ExtSvcLoginPrefix(autoAssignOrgID) + "my-service-account",
				},
				expectedIsExternal: true,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.description, func(t *testing.T) {
				serviceMock.ExpectedServiceAccountProfile = tc.expectedServiceAccount
				sa, err := svc.RetrieveServiceAccount(context.Background(), &sa.GetServiceAccountQuery{OrgID: autoAssignOrgID, ID: testServiceAccountId})
				assert.NoError(t, err, tc.description)
				assert.Equal(t, tc.expectedIsExternal, sa.IsExternal, tc.description)
			})
		}
	})

	t.Run("should flag external service accounts correctly", func(t *testing.T) {
		serviceMock.ExpectedSearchOrgServiceAccountsResult = &sa.SearchOrgServiceAccountsResult{
			TotalCount: 2,
			ServiceAccounts: []*sa.ServiceAccountDTO{
				{Login: "test"},
				{Login: sa.ExtSvcLoginPrefix(autoAssignOrgID) + "test"},
			},
			Page:    1,
			PerPage: 2,
		}
		res, err := svc.SearchOrgServiceAccounts(context.Background(), &sa.SearchOrgServiceAccountsQuery{OrgID: 1})
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
			form                   sa.UpdateServiceAccountForm
			expectedServiceAccount *sa.ServiceAccountProfileDTO
			expectedError          error
		}{
			{
				description: "should update a non-external service account with a valid name",
				form: sa.UpdateServiceAccountForm{
					Name: &nameWithoutProtectedPrefix,
				},
				expectedServiceAccount: &sa.ServiceAccountProfileDTO{
					Login: "my-service-account",
				},
				expectedError: nil,
			},
			{
				description: "should not allow to update a non-external service account with extsvc prefix",
				form: sa.UpdateServiceAccountForm{
					Name: &nameWithProtectedPrefix,
				},
				expectedServiceAccount: &sa.ServiceAccountProfileDTO{
					Login: "my-service-account",
				},
				expectedError: extsvcaccounts.ErrInvalidName,
			},
			{
				description: "should not allow to update an external service account with a valid name",
				form: sa.UpdateServiceAccountForm{
					Name: &nameWithoutProtectedPrefix,
				},
				expectedServiceAccount: &sa.ServiceAccountProfileDTO{
					Login: sa.ExtSvcLoginPrefix(autoAssignOrgID) + "my-service-account",
				},
				expectedError: extsvcaccounts.ErrCannotBeUpdated,
			},
			{
				description: "should not allow to update an external service account with a extsvc prefix",
				form: sa.UpdateServiceAccountForm{
					Name: &nameWithProtectedPrefix,
				},
				expectedServiceAccount: &sa.ServiceAccountProfileDTO{
					Login: sa.ExtSvcLoginPrefix(autoAssignOrgID) + "my-service-account",
				},
				expectedError: extsvcaccounts.ErrInvalidName,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.description, func(t *testing.T) {
				tc := tc
				serviceMock.ExpectedServiceAccountProfile = tc.expectedServiceAccount
				_, err := svc.UpdateServiceAccount(context.Background(), autoAssignOrgID, testServiceAccountId, &tc.form)
				assert.Equal(t, tc.expectedError, err, tc.description)
			})
		}
	})

	t.Run("should add service account tokens", func(t *testing.T) {
		testCases := []struct {
			description            string
			cmd                    sa.AddServiceAccountTokenCommand
			expectedServiceAccount *sa.ServiceAccountProfileDTO
			expectedError          error
		}{
			{
				description: "should allow to create a service account token",
				cmd: sa.AddServiceAccountTokenCommand{
					OrgId: autoAssignOrgID,
				},
				expectedServiceAccount: &sa.ServiceAccountProfileDTO{
					Login: "my-service-account",
				},
				expectedError: nil,
			},
			{
				description: "should not allow to create a service account token",
				cmd: sa.AddServiceAccountTokenCommand{
					OrgId: autoAssignOrgID,
				},
				expectedServiceAccount: &sa.ServiceAccountProfileDTO{
					Login: sa.ExtSvcLoginPrefix(autoAssignOrgID) + "my-service-account",
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
		assert.False(t, sa.IsExternalServiceAccount("my-service-account"))
		assert.False(t, sa.IsExternalServiceAccount("sa-my-service-account"))
		assert.False(t, sa.IsExternalServiceAccount(sa.ExtSvcPrefix+"my-service-account")) // It's not a external service account login
		assert.True(t, sa.IsExternalServiceAccount(sa.ExtSvcLoginPrefix(autoAssignOrgID)+"my-service-account"))
	})
}

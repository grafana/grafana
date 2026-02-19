package notifier

import (
	"context"
	"encoding/base64"
	"maps"
	"slices"
	"testing"

	alertingModels "github.com/grafana/alerting/models"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	ac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/alertmanager_mock"
	"github.com/grafana/grafana/pkg/services/org"
	secrets_fakes "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
)

func TestReceiverTestingService_TestNewReceiverIntegration(t *testing.T) {
	// region setup
	alert := Alert{
		Labels: map[string]string{
			"alertName": "test",
		},
		Annotations: map[string]string{
			"description": "test",
		},
	}

	orgID := int64(1)
	receiverSvcFake := &FakeReceiverService{}
	expectedResult := IntegrationTestResult{
		Name: "test",
	}
	amMock := alertmanager_mock.NewAlertmanagerMock(t)
	amMock.EXPECT().TestIntegration(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(alertingModels.IntegrationStatus(expectedResult), nil)

	amProviderFake := &FakeAlertmanagerProvider{
		AlertmanagerForFunc: func(orgID int64) (Alertmanager, error) {
			return amMock, nil
		},
	}
	encryptionServiceFake := secrets_fakes.NewFakeSecretsService()
	authz := ac.NewReceiverAccess[*models.Receiver](acimpl.ProvideAccessControl(featuremgmt.WithFeatures()), false)
	svc := &ReceiverTestingService{
		receiverSvc:       receiverSvcFake,
		amProvider:        amProviderFake,
		encryptionService: encryptionServiceFake,
		authz:             authz,
	}

	userAuthorizedToCreate := &user.SignedInUser{OrgID: orgID, OrgRole: org.RoleNone, Permissions: map[int64]map[string][]string{
		orgID: {
			accesscontrol.ActionAlertingReceiversCreate:     nil,
			accesscontrol.ActionAlertingReceiversRead:       []string{models.ScopeReceiversProvider.GetResourceAllScope()},
			accesscontrol.ActionAlertingReceiversTestCreate: []string{models.ScopeReceiversProvider.GetNewResourceScope()},
		},
	}}

	userAuthorizedToUpdateAndTest := &user.SignedInUser{OrgID: orgID, OrgRole: org.RoleNone, Permissions: map[int64]map[string][]string{
		orgID: {
			accesscontrol.ActionAlertingReceiversRead:       []string{models.ScopeReceiversProvider.GetResourceScopeUID("test")},
			accesscontrol.ActionAlertingReceiversTestCreate: []string{models.ScopeReceiversProvider.GetResourceScopeUID("test")},
			accesscontrol.ActionAlertingReceiversUpdate:     []string{models.ScopeReceiversProvider.GetResourceScopeUID("test")},
		},
	}}

	integration := models.IntegrationGen(models.IntegrationMuts.WithUID(""))()

	expectedAlert, err := convertToAlertParam(alert)
	require.NoError(t, err)
	// endregion setup

	testCases := []struct {
		name        string
		integration *models.Integration
		user        identity.Requester
		expectedErr error
	}{
		{
			name:        "error if integration UID is not empty",
			integration: utils.Pointer(models.IntegrationGen()()),
			user:        userAuthorizedToCreate,
			expectedErr: models.ErrReceiverTestingInvalidIntegrationBase,
		},
		{
			name:        "error if user is not authorized to create new receivers",
			user:        userAuthorizedToUpdateAndTest,
			expectedErr: ac.ErrAuthorizationBase,
		},
		{
			name: "integration is tested successfully (receiverUID empty)",
			user: userAuthorizedToCreate,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.integration == nil {
				tc.integration = &integration
			}
			result, err := svc.TestNewReceiverIntegration(context.Background(), tc.user, alert, *tc.integration)
			if tc.expectedErr != nil {
				require.ErrorIs(t, err, tc.expectedErr)
				return
			}
			require.NoError(t, err)
			amMock.AssertExpectations(t)
			require.Equal(t, expectedResult, result)
			amMock.AssertExpectations(t)
			amMock.AssertCalled(t, "TestIntegration", mock.Anything, "test-receiver", *tc.integration, expectedAlert)
		})
	}
}

func TestReceiverTestingService_PatchIntegrationAndTest(t *testing.T) {
	// region setup
	alert := Alert{
		Labels: map[string]string{
			"alertName": "test",
		},
		Annotations: map[string]string{
			"description": "test",
		},
	}

	receiverUID := "receiver-uid"
	integrationUID := "integration-uid"
	orgID := int64(1)

	// Create a webhook integration with a known URL (protected field)
	existingIntegration := models.IntegrationGen(
		models.IntegrationMuts.WithUID(integrationUID),
		models.IntegrationMuts.WithValidConfig("webhook"),
		models.IntegrationMuts.WithSettings(map[string]any{
			"url": "http://example.com",
		}),
		models.IntegrationMuts.WithSecureSettings(map[string]string{
			"username": base64.StdEncoding.EncodeToString([]byte("test-secret-user")),
			"password": base64.StdEncoding.EncodeToString([]byte("test-secret-pass")),
		}),
	)()

	existingReceiver := &models.Receiver{UID: receiverUID, Name: "existing", Integrations: []*models.Integration{&existingIntegration}}

	receiverSvcFake := &FakeReceiverService{
		GetReceiverFunc: func(ctx context.Context, uid string, decrypt bool, user identity.Requester) (*models.Receiver, error) {
			if receiverUID != uid {
				return nil, models.ErrReceiverNotFound.Errorf("")
			}
			return existingReceiver, nil
		},
	}
	amProviderFake := &FakeAlertmanagerProvider{}
	authz := ac.NewReceiverAccess[*models.Receiver](acimpl.ProvideAccessControl(featuremgmt.WithFeatures()), false)
	encryptionServiceFake := secrets_fakes.NewFakeSecretsService()

	svc := &ReceiverTestingService{
		receiverSvc:       receiverSvcFake,
		amProvider:        amProviderFake,
		encryptionService: encryptionServiceFake,
		authz:             authz,
	}

	expectedAlert, err := convertToAlertParam(alert)
	require.NoError(t, err)

	authorizedUser := &user.SignedInUser{OrgID: orgID, OrgRole: org.RoleNone, Permissions: map[int64]map[string][]string{
		orgID: {
			accesscontrol.ActionAlertingReceiversTestCreate: []string{models.ScopeReceiversAll},
			accesscontrol.ActionAlertingReceiversRead:       []string{models.ScopeReceiversAll},
			accesscontrol.ActionAlertingReceiversUpdate:     []string{models.ScopeReceiversAll},
		},
	}}
	// endregion setup

	testCases := []struct {
		name           string
		receiverUID    string
		integration    *models.Integration
		secretsToPatch []string
		user           identity.Requester
		expectedErr    error
	}{
		{
			name:        "error if receiver UID is empty",
			receiverUID: "",
			expectedErr: models.ErrReceiverTestingInvalidIntegrationBase,
		},
		{
			name:        "error if user is not authorized to update receiver",
			receiverUID: receiverUID,
			user:        &user.SignedInUser{OrgID: orgID, OrgRole: org.RoleNone, Permissions: map[int64]map[string][]string{}},
			expectedErr: ac.ErrAuthorizationBase,
		},
		{
			name:        "error if user is not authorized to test receiver",
			receiverUID: receiverUID,
			user: &user.SignedInUser{OrgID: orgID, OrgRole: org.RoleNone, Permissions: map[int64]map[string][]string{
				orgID: {
					accesscontrol.ActionAlertingReceiversRead:   []string{models.ScopeReceiversAll},
					accesscontrol.ActionAlertingReceiversUpdate: []string{models.ScopeReceiversAll},
				},
			}},
			expectedErr: ac.ErrAuthorizationBase,
		},
		{
			name:        "error if receiver does not exist",
			receiverUID: "non-existent-receiver",
			expectedErr: models.ErrReceiverNotFound,
		},
		{
			name:        "error if integration does not exist in receiver",
			receiverUID: receiverUID,
			integration: utils.Pointer(models.IntegrationGen(models.IntegrationMuts.WithUID("other-integration"))()),
			expectedErr: models.ErrReceiverTestingIntegrationNotFound,
		},
		{
			name:        "error if user changes protected field (url) without permission",
			receiverUID: receiverUID,
			integration: utils.Pointer(models.IntegrationGen(
				models.IntegrationMuts.WithUID(integrationUID),
				models.IntegrationMuts.WithValidConfig("webhook"),
				models.IntegrationMuts.AddSetting("url", "http://different-url.com"),
			)()),
			expectedErr: ac.ErrAuthorizationBase,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.user == nil {
				tc.user = authorizedUser
			}
			if tc.integration == nil {
				tc.integration = &existingIntegration
			}
			_, err := svc.PatchIntegrationAndTest(context.Background(), tc.user, alert, tc.receiverUID, *tc.integration, tc.secretsToPatch)
			require.ErrorIs(t, err, tc.expectedErr)
		})
	}

	expectedResult := IntegrationTestResult{Name: "test"}

	t.Run("integration is tested successfully no secrets to patch", func(t *testing.T) {
		amMock := alertmanager_mock.NewAlertmanagerMock(t)
		amMock.EXPECT().TestIntegration(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(alertingModels.IntegrationStatus(expectedResult), nil)
		amProviderFake.AlertmanagerForFunc = func(orgID int64) (Alertmanager, error) { return amMock, nil }
		t.Cleanup(func() { amProviderFake.AlertmanagerForFunc = nil })

		i := existingIntegration.Clone()
		i.SecureSettings = nil
		result, err := svc.PatchIntegrationAndTest(context.Background(), authorizedUser, alert, receiverUID, i, nil)
		require.NoError(t, err)
		require.Equal(t, expectedResult, result)
		amMock.AssertExpectations(t)
		amMock.AssertCalled(t, "TestIntegration", mock.Anything, existingReceiver.Name, i, expectedAlert)
	})

	t.Run("integration is patched and tested successfully", func(t *testing.T) {
		amMock := alertmanager_mock.NewAlertmanagerMock(t)
		amMock.EXPECT().TestIntegration(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(alertingModels.IntegrationStatus(expectedResult), nil)
		amProviderFake.AlertmanagerForFunc = func(orgID int64) (Alertmanager, error) { return amMock, nil }
		t.Cleanup(func() { amProviderFake.AlertmanagerForFunc = nil })

		i := existingIntegration.Clone()
		secrets := slices.Collect(maps.Keys(existingIntegration.SecureSettings))
		i.SecureSettings = nil

		result, err := svc.PatchIntegrationAndTest(context.Background(), authorizedUser, alert, receiverUID, i, secrets)
		require.NoError(t, err)
		require.Equal(t, expectedResult, result)

		expectedIntegration := i.Clone()
		expectedIntegration.SecureSettings = existingIntegration.SecureSettings

		amMock.AssertExpectations(t)
		amMock.AssertCalled(t, "TestIntegration", mock.Anything, existingReceiver.Name, expectedIntegration, expectedAlert)
	})

	t.Run("integration does not need to be patched", func(t *testing.T) {
		amMock := alertmanager_mock.NewAlertmanagerMock(t)
		amMock.EXPECT().TestIntegration(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(alertingModels.IntegrationStatus(expectedResult), nil)
		amProviderFake.AlertmanagerForFunc = func(orgID int64) (Alertmanager, error) { return amMock, nil }
		t.Cleanup(func() { amProviderFake.AlertmanagerForFunc = nil })

		i := existingIntegration.Clone()
		i.SecureSettings = nil

		result, err := svc.PatchIntegrationAndTest(context.Background(), authorizedUser, alert, receiverUID, i, nil)
		require.NoError(t, err)
		require.Equal(t, expectedResult, result)

		amMock.AssertExpectations(t)
		amMock.AssertCalled(t, "TestIntegration", mock.Anything, existingReceiver.Name, i, expectedAlert)
	})
}

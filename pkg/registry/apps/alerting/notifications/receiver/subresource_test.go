package receiver

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
)

func TestValidateCreateReceiverIntegrationTestRequestBody(t *testing.T) {
	testCases := []struct {
		name        string
		receiverUID string
		body        v0alpha1.CreateReceiverIntegrationTestRequestBody
		expectError string
	}{
		{
			name:        "new receiver with integrationRef should fail",
			receiverUID: "",
			body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
				IntegrationRef: &v0alpha1.CreateReceiverIntegrationTestRequestV0alpha1BodyIntegrationRef{
					Uid: "some-uid",
				},
			},
			expectError: "only full integration configuration must be provided for testing a new receiver",
		},
		{
			name:        "new receiver without integration should fail",
			receiverUID: "",
			body:        v0alpha1.CreateReceiverIntegrationTestRequestBody{},
			expectError: "integration settings must be specified when testing a new receiver",
		},
		{
			name:        "new receiver with integration UID should fail",
			receiverUID: "",
			body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
				Integration: &v0alpha1.CreateReceiverIntegrationTestRequestIntegration{
					Uid:      utils.Pointer("integration-uid"),
					Type:     "slack",
					Settings: map[string]any{},
				},
			},
			expectError: "integration UID must be empty when testing a new receiver",
		},
		{
			name:        "new receiver with secure fields should fail",
			receiverUID: "",
			body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
				Integration: &v0alpha1.CreateReceiverIntegrationTestRequestIntegration{
					Type:         "slack",
					Settings:     map[string]any{},
					SecureFields: map[string]bool{"token": true},
				},
			},
			expectError: "integration must not have secure fields when testing a new receiver",
		},
		{
			name:        "both integrationRef and integration set should fail",
			receiverUID: "receiver-uid",
			body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
				Integration: &v0alpha1.CreateReceiverIntegrationTestRequestIntegration{
					Type:     "slack",
					Settings: map[string]any{},
				},
				IntegrationRef: &v0alpha1.CreateReceiverIntegrationTestRequestV0alpha1BodyIntegrationRef{
					Uid: "integration-uid",
				},
			},
			expectError: "integrationRef and integration cannot be set at the same time",
		},
		{
			name:        "neither integrationRef nor integration set should fail",
			receiverUID: "receiver-uid",
			body:        v0alpha1.CreateReceiverIntegrationTestRequestBody{},
			expectError: "integrationRef or integration must be set",
		},
		{
			name:        "integrationRef with empty UID should fail",
			receiverUID: "receiver-uid",
			body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
				IntegrationRef: &v0alpha1.CreateReceiverIntegrationTestRequestV0alpha1BodyIntegrationRef{
					Uid: "",
				},
			},
			expectError: "integrationRef UID must be set",
		},
		{
			name:        "new integration without UID but with secure fields should fail",
			receiverUID: "receiver-uid",
			body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
				Integration: &v0alpha1.CreateReceiverIntegrationTestRequestIntegration{
					Type:         "slack",
					Settings:     map[string]any{},
					SecureFields: map[string]bool{"token": true},
				},
			},
			expectError: "integration must have a UID to be tested with patched secure settings",
		},
		{
			name:        "new integration with empty UID and secure fields should fail",
			receiverUID: "receiver-uid",
			body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
				Integration: &v0alpha1.CreateReceiverIntegrationTestRequestIntegration{
					Uid:          utils.Pointer(""),
					Type:         "slack",
					Settings:     map[string]any{},
					SecureFields: map[string]bool{"token": true},
				},
			},
			expectError: "integration must have a UID to be tested with patched secure settings",
		},
		{
			name:        "valid new receiver with full integration",
			receiverUID: "",
			body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
				Integration: &v0alpha1.CreateReceiverIntegrationTestRequestIntegration{
					Type:     "slack",
					Settings: map[string]any{"url": "https://slack.com/webhook"},
				},
			},
			expectError: "",
		},
		{
			name:        "valid existing receiver with integrationRef",
			receiverUID: "receiver-uid",
			body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
				IntegrationRef: &v0alpha1.CreateReceiverIntegrationTestRequestV0alpha1BodyIntegrationRef{
					Uid: "integration-uid",
				},
			},
			expectError: "",
		},
		{
			name:        "valid existing receiver with new integration",
			receiverUID: "receiver-uid",
			body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
				Integration: &v0alpha1.CreateReceiverIntegrationTestRequestIntegration{
					Type:     "slack",
					Settings: map[string]any{"url": "https://slack.com/webhook"},
				},
			},
			expectError: "",
		},
		{
			name:        "valid existing receiver with patched integration (has UID and secure fields)",
			receiverUID: "receiver-uid",
			body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
				Integration: &v0alpha1.CreateReceiverIntegrationTestRequestIntegration{
					Uid:          utils.Pointer("integration-uid"),
					Type:         "slack",
					Settings:     map[string]any{"url": "https://slack.com/webhook"},
					SecureFields: map[string]bool{"token": true},
				},
			},
			expectError: "",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateCreateReceiverIntegrationTestRequestBody(tc.receiverUID, tc.body)
			if tc.expectError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.expectError)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestTestReceiver(t *testing.T) {
	uid := func(s string) *string { return &s }

	testCases := []struct {
		name              string
		receiverUID       string
		body              v0alpha1.CreateReceiverIntegrationTestRequestBody
		expectedMethod    string
		expectedAssertion func(t *testing.T, call testingServiceCall)
		expectError       bool
	}{
		{
			name:        "uses TestByIntegrationUID when integrationRef is provided",
			receiverUID: "receiver-uid",
			body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
				IntegrationRef: &v0alpha1.CreateReceiverIntegrationTestRequestV0alpha1BodyIntegrationRef{
					Uid: "integration-uid",
				},
				Alert: v0alpha1.CreateReceiverIntegrationTestRequestAlert{
					Labels:      map[string]string{"alertname": "test"},
					Annotations: map[string]string{"summary": "test alert"},
				},
			},
			expectedMethod: "TestByIntegrationUID",
			expectedAssertion: func(t *testing.T, call testingServiceCall) {
				assert.Equal(t, "receiver-uid", call.receiverUID)
				assert.Equal(t, "integration-uid", call.integrationUID)
				assert.Equal(t, map[string]string{"alertname": "test"}, call.alert.Labels)
				assert.Equal(t, map[string]string{"summary": "test alert"}, call.alert.Annotations)
			},
		},
		{
			name:        "uses TestNewReceiverIntegration when new receiver and integration provided",
			receiverUID: "",
			body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
				Integration: &v0alpha1.CreateReceiverIntegrationTestRequestIntegration{
					Type:     "slack",
					Settings: map[string]any{"url": "https://slack.com/webhook"},
				},
				Alert: v0alpha1.CreateReceiverIntegrationTestRequestAlert{
					Labels: map[string]string{"alertname": "test"},
				},
			},
			expectedMethod: "TestNewReceiverIntegration",
			expectedAssertion: func(t *testing.T, call testingServiceCall) {
				assert.Equal(t, "slack", string(call.integration.Config.Type()))
				assert.Equal(t, map[string]string{"alertname": "test"}, call.alert.Labels)
			},
		},
		{
			name:        "uses TestNewReceiverIntegration with placeholder receiver UID",
			receiverUID: newReceiverNamePlaceholder,
			body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
				Integration: &v0alpha1.CreateReceiverIntegrationTestRequestIntegration{
					Type:     "slack",
					Settings: map[string]any{"url": "https://slack.com/webhook"},
				},
				Alert: v0alpha1.CreateReceiverIntegrationTestRequestAlert{
					Labels: map[string]string{"alertname": "test"},
				},
			},
			expectedMethod: "TestNewReceiverIntegration",
			expectedAssertion: func(t *testing.T, call testingServiceCall) {
				assert.Equal(t, "slack", string(call.integration.Config.Type()))
			},
		},
		{
			name:        "uses PatchIntegrationAndTest when existing receiver with integration provided",
			receiverUID: "receiver-uid",
			body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
				Integration: &v0alpha1.CreateReceiverIntegrationTestRequestIntegration{
					Uid:          uid("integration-uid"),
					Type:         "slack",
					Settings:     map[string]any{"url": "https://slack.com/webhook"},
					SecureFields: map[string]bool{"token": true},
				},
				Alert: v0alpha1.CreateReceiverIntegrationTestRequestAlert{
					Labels: map[string]string{"alertname": "test"},
				},
			},
			expectedMethod: "PatchIntegrationAndTest",
			expectedAssertion: func(t *testing.T, call testingServiceCall) {
				assert.Equal(t, "receiver-uid", call.receiverUID)
				assert.Equal(t, "integration-uid", call.integration.UID)
				assert.Equal(t, "slack", string(call.integration.Config.Type()))
				assert.Equal(t, []string{"token"}, call.requiredSecret)
			},
		},
		{
			name:        "uses PatchIntegrationAndTest when existing receiver with new integration (no UID)",
			receiverUID: "receiver-uid",
			body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
				Integration: &v0alpha1.CreateReceiverIntegrationTestRequestIntegration{
					Type:     "slack",
					Settings: map[string]any{"url": "https://slack.com/webhook"},
				},
				Alert: v0alpha1.CreateReceiverIntegrationTestRequestAlert{
					Labels: map[string]string{"alertname": "test"},
				},
			},
			expectedMethod: "PatchIntegrationAndTest",
			expectedAssertion: func(t *testing.T, call testingServiceCall) {
				assert.Equal(t, "receiver-uid", call.receiverUID)
				assert.Empty(t, call.integration.UID)
				assert.Equal(t, "slack", string(call.integration.Config.Type()))
				assert.Empty(t, call.requiredSecret)
			},
		},
		{
			name:        "returns error when validation fails",
			receiverUID: "receiver-uid",
			body:        v0alpha1.CreateReceiverIntegrationTestRequestBody{},
			expectError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			fake := &fakeTestingService{}
			handler := New(fake)

			testUser := &user.SignedInUser{OrgID: 1, UserID: 1}
			_, err := handler.TestReceiver(context.Background(), testUser, tc.receiverUID, tc.body)

			if tc.expectError {
				require.Error(t, err)
				assert.Empty(t, fake.calls)
				return
			}

			require.NoError(t, err)
			require.Len(t, fake.calls, 1)
			assert.Equal(t, tc.expectedMethod, fake.calls[0].method)
			if tc.expectedAssertion != nil {
				tc.expectedAssertion(t, fake.calls[0])
			}
		})
	}
}

type fakeTestingService struct {
	calls []testingServiceCall
}

type testingServiceCall struct {
	method         string
	receiverUID    string
	integrationUID string
	integration    models.Integration
	requiredSecret []string
	alert          notifier.Alert
}

func (f *fakeTestingService) TestByIntegrationUID(_ context.Context, _ identity.Requester, alert notifier.Alert, receiverUID string, integrationUID string) (notifier.IntegrationTestResult, error) {
	f.calls = append(f.calls, testingServiceCall{
		method:         "TestByIntegrationUID",
		receiverUID:    receiverUID,
		integrationUID: integrationUID,
		alert:          alert,
	})
	return notifier.IntegrationTestResult{}, nil
}

func (f *fakeTestingService) TestNewReceiverIntegration(_ context.Context, _ identity.Requester, alert notifier.Alert, integration models.Integration) (notifier.IntegrationTestResult, error) {
	f.calls = append(f.calls, testingServiceCall{
		method:      "TestNewReceiverIntegration",
		integration: integration,
		alert:       alert,
	})
	return notifier.IntegrationTestResult{}, nil
}

func (f *fakeTestingService) PatchIntegrationAndTest(_ context.Context, _ identity.Requester, alert notifier.Alert, receiverUID string, integration models.Integration, requiredSecrets []string) (notifier.IntegrationTestResult, error) {
	f.calls = append(f.calls, testingServiceCall{
		method:         "PatchIntegrationAndTest",
		receiverUID:    receiverUID,
		integration:    integration,
		requiredSecret: requiredSecrets,
		alert:          alert,
	})
	return notifier.IntegrationTestResult{}, nil
}

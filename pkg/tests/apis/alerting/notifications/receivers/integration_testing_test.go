package receivers

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/alerting/definition"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	alertingauthz "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/api/alerting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationLegacyReceiverAuthorizationTest(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := getTestHelper(t)

	org1 := helper.Org1

	adminClient, err := v0alpha1.NewReceiverClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
	require.NoError(t, err)

	existingReceiver, err := adminClient.Create(ctx, &v0alpha1.Receiver{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.ReceiverSpec{
			Title: "test-receiver-1",
			Integrations: []v0alpha1.ReceiverIntegration{
				createIntegration(t, "webhook"),
			},
		},
	}, resource.CreateOptions{})
	require.NoError(t, err)

	data, err := json.Marshal(existingReceiver.Spec.Integrations[0].Settings)
	require.NoError(t, err)

	legacyReceiver := apimodels.PostableApiReceiver{
		Receiver: config.Receiver{
			Name: existingReceiver.Spec.Title,
		},
		PostableGrafanaReceivers: definition.PostableGrafanaReceivers{
			GrafanaManagedReceivers: []*definition.PostableGrafanaReceiver{
				{
					UID:      *existingReceiver.Spec.Integrations[0].Uid,
					Type:     existingReceiver.Spec.Integrations[0].Type,
					Settings: apimodels.RawMessage(data),
				},
			},
		},
	}

	alert := apimodels.TestReceiversConfigAlertParams{
		Labels: map[model.LabelName]model.LabelValue{
			"alertname": "test-alert",
		},
	}

	t.Run("should allow to test when provided permissions", func(t *testing.T) {
		testCases := []struct {
			name            string
			user            apis.User
			canTestNew      bool
			canTestExisting bool
		}{
			// region positive tests
			{
				name:            "basic editor",
				user:            org1.Editor,
				canTestNew:      true,
				canTestExisting: true,
			},
			{
				name:            "basic admin",
				user:            org1.Admin,
				canTestNew:      true,
				canTestExisting: true,
			},
			{
				name: "legacy test",
				user: func() apis.User {
					return helper.CreateUser("legacyTester", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
						{
							Actions: []string{
								accesscontrol.ActionAlertingReceiversTest,
							},
						},
					})
				}(),
				canTestNew:      true,
				canTestExisting: true,
			},
			{
				name: "legacy notification writer",
				user: func() apis.User {
					return helper.CreateUser("legacyWriter", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
						{
							Actions: []string{
								accesscontrol.ActionAlertingNotificationsRead,
								accesscontrol.ActionAlertingNotificationsWrite,
							},
						},
					})
				}(),
				canTestNew:      true,
				canTestExisting: true,
			},
			{
				name: "receiver creator + create-test",
				user: func() apis.User {
					return helper.CreateUser("creatorAndTester", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
						{
							Actions: []string{accesscontrol.ActionAlertingReceiversCreate, accesscontrol.ActionAlertingReceiversRead},
						},
						{
							Actions:           []string{accesscontrol.ActionAlertingReceiversTestCreate},
							Resource:          models.ScopeReceiversRoot,
							ResourceAttribute: "type",
							ResourceID:        alertingauthz.NewReceiverType,
						},
					})
				}(),
				canTestNew:      true,
				canTestExisting: false,
			},
			{
				name: "receiver editor + tester",
				user: func() apis.User {
					return helper.CreateUser("editorAndTester", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
						{
							Actions:           []string{accesscontrol.ActionAlertingReceiversRead, accesscontrol.ActionAlertingReceiversUpdate, accesscontrol.ActionAlertingReceiversTestCreate},
							Resource:          models.ScopeReceiversRoot,
							ResourceAttribute: "uid",
							ResourceID:        existingReceiver.Name,
						},
					})
				}(),
				canTestNew:      false,
				canTestExisting: true,
			},
			// endregion
			// region negative tests
			{
				name: "unauthorized",
				user: func() apis.User {
					return helper.CreateUser("unauthorized", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{})
				}(),
			},
			{
				name: "basic reader",
				user: org1.Viewer,
			},
			{
				name: "legacy reader",
				user: func() apis.User {
					return helper.CreateUser("legacyReader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
						{
							Actions: []string{
								accesscontrol.ActionAlertingNotificationsRead,
							},
						},
					})
				}(),
			},
			{
				name: "reader",
				user: func() apis.User {
					return helper.CreateUser("reader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
						createWildcardPermission(accesscontrol.ActionAlertingReceiversRead),
					})
				}(),
			},
			{
				name: "receiver updater no test",
				user: func() apis.User {
					return helper.CreateUser("updater-no-test", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
						createWildcardPermission(
							accesscontrol.ActionAlertingReceiversRead,
							accesscontrol.ActionAlertingReceiversUpdate,
						),
					})
				}(),
			},
			{
				name: "provisioning updater + test",
				user: func() apis.User {
					return helper.CreateUser("provisioning-writer", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
						createWildcardPermission(
							accesscontrol.ActionAlertingNotificationsProvisioningRead,
							accesscontrol.ActionAlertingNotificationsProvisioningWrite,
							accesscontrol.ActionAlertingReceiversTestCreate,
						),
					})
				}(),
			},
			// endregion
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				cfg := tc.user.NewRestConfig()
				helper.GetEnv().NotificationService.WebhookHandler = func(ctx context.Context, sync *notifications.SendWebhookSync) error {
					return nil
				}
				alertingApi := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cfg.Username, cfg.Password)

				prefix := "cannot"
				if tc.canTestNew {
					prefix = "can"
				}
				t.Run(prefix+" test when no integration UID provided", func(t *testing.T) {
					resp, code, err := alertingApi.TestReceiver(t, apimodels.TestReceiversConfigBodyParams{
						Alert: &alert,
						Receivers: []*apimodels.PostableApiReceiver{
							{
								Receiver: config.Receiver{
									Name: "test-receiver-2",
								},
								PostableGrafanaReceivers: definition.PostableGrafanaReceivers{
									GrafanaManagedReceivers: []*definition.PostableGrafanaReceiver{
										{
											UID:      "",
											Type:     "webhook",
											Settings: apimodels.RawMessage(`{"url":"http://localhost:8080"}`),
										},
									},
								},
							},
						},
					})
					require.NoError(t, err)
					expectedCode := 207
					if !tc.canTestNew {
						expectedCode = 403
					}
					require.Equalf(t, expectedCode, code, "Expected 200, got %d: %s", code, string(resp))
				})

				prefix = "cannot"
				if tc.canTestExisting {
					prefix = "can"
				}
				t.Run(prefix+" test integration when UID provided", func(t *testing.T) {
					resp, code, err := alertingApi.TestReceiver(t, apimodels.TestReceiversConfigBodyParams{
						Alert: &alert,
						Receivers: []*apimodels.PostableApiReceiver{
							&legacyReceiver,
						},
					})
					require.NoError(t, err)
					expectedCode := 207
					if !tc.canTestExisting {
						expectedCode = 403
					}
					require.Equalf(t, expectedCode, code, "Expected 200, got %d: %s", code, string(resp))
				})
			})
		}
	})
}

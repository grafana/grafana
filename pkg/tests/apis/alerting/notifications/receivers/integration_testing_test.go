package receivers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"maps"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/resource"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/testutil"
)

var NoReceiverIdentifier = resource.Identifier{
	Namespace: "default",
	Name:      "-",
}

func TestIntegrationReceiverAuthorizationTest(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := getTestHelper(t)

	helper.GetEnv().NotificationService.WebhookHandler = func(ctx context.Context, sync *notifications.SendWebhookSync) error {
		return nil
	}

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

	alert := v0alpha1.CreateReceiverIntegrationTestRequestAlert{
		Labels: map[string]string{
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
				canTestExisting: false,
			},
			{
				name: "legacy test + reader",
				user: func() apis.User {
					return helper.CreateUser("legacyTesterReader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
						{
							Actions: []string{
								accesscontrol.ActionAlertingReceiversTest,
							},
						},
						{
							Actions:           []string{accesscontrol.ActionAlertingReceiversRead},
							Resource:          models.ScopeReceiversRoot,
							ResourceAttribute: "uid",
							ResourceID:        existingReceiver.Name,
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
							Actions: []string{accesscontrol.ActionAlertingReceiversCreate},
						},
						{
							Actions:           []string{accesscontrol.ActionAlertingReceiversTestCreate},
							Resource:          models.ScopeReceiversRoot,
							ResourceAttribute: "uid",
							ResourceID:        models.NewReceiverScopeID,
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
				client, err := v0alpha1.NewReceiverClientFromGenerator(tc.user.GetClientRegistry())
				require.NoError(t, err)

				prefix := "cannot"
				if tc.canTestNew {
					prefix = "can"
				}
				t.Run(prefix+" test when no receiver name provided", func(t *testing.T) {
					resp, err := client.CreateReceiverIntegrationTest(ctx, NoReceiverIdentifier, v0alpha1.CreateReceiverIntegrationTestRequest{
						Body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
							Integration: v0alpha1.CreateReceiverIntegrationTestRequestIntegration{
								Type: "webhook",
								Settings: map[string]interface{}{
									"url": "http://localhost:8080",
								},
							},
							Alert: alert,
						},
					})
					if tc.canTestNew {
						require.NoError(t, err)
					} else {
						d, _ := json.Marshal(resp)
						require.Truef(t, errors.IsForbidden(err), "Response %s", string(d))
					}
				})

				prefix = "cannot"
				if tc.canTestExisting {
					prefix = "can"
				}
				t.Run(prefix+" test integration when receiver name is provided", func(t *testing.T) {
					t.Run("and existing integration is tested", func(t *testing.T) {
						resp, err := client.CreateReceiverIntegrationTest(ctx, existingReceiver.GetStaticMetadata().Identifier(), v0alpha1.CreateReceiverIntegrationTestRequest{
							Body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
								Integration: v0alpha1.CreateReceiverIntegrationTestRequestIntegration(existingReceiver.Spec.Integrations[0]),
								Alert:       alert,
							},
						})
						if tc.canTestExisting {
							require.NoError(t, err)
						} else {
							d, _ := json.Marshal(resp)
							require.Truef(t, errors.IsForbidden(err), "Response %s", string(d))
						}
					})
					t.Run("and new integration is tested", func(t *testing.T) {
						resp, err := client.CreateReceiverIntegrationTest(ctx, existingReceiver.GetStaticMetadata().Identifier(), v0alpha1.CreateReceiverIntegrationTestRequest{
							Body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
								Integration: v0alpha1.CreateReceiverIntegrationTestRequestIntegration{
									Uid:  nil,
									Type: "webhook",
									Settings: map[string]interface{}{
										"url": "http://localhost:8080",
									},
								},
								Alert: alert,
							},
						})
						if tc.canTestExisting {
							require.NoError(t, err)
						} else {
							d, _ := json.Marshal(resp)
							require.Truef(t, errors.IsForbidden(err), "Response %s", string(d))
						}
					})
				})
			})
		}
	})

	t.Run("should require protected:write permission if existing integration is tested", func(t *testing.T) {
		modified, err := adminClient.Get(ctx, existingReceiver.GetStaticMetadata().Identifier())
		require.NoError(t, err)

		modifiedIntegration := v0alpha1.CreateReceiverIntegrationTestRequestIntegration(modified.Spec.Integrations[0])
		modifiedIntegration.Settings["url"] = "http://localhost:8080/protected"

		request := v0alpha1.CreateReceiverIntegrationTestRequest{
			Body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
				Integration: modifiedIntegration,
				Alert:       alert,
			},
		}

		noProtected := helper.CreateUser("updater+no-protected", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{accesscontrol.ActionAlertingReceiversRead, accesscontrol.ActionAlertingReceiversUpdate, accesscontrol.ActionAlertingReceiversTestCreate},
				Resource:          models.ScopeReceiversRoot,
				ResourceAttribute: "uid",
				ResourceID:        existingReceiver.Name,
			},
		})
		client, err := v0alpha1.NewReceiverClientFromGenerator(noProtected.GetClientRegistry())
		require.NoError(t, err)

		resp, err := client.CreateReceiverIntegrationTest(ctx, existingReceiver.GetStaticMetadata().Identifier(), request)

		var d []byte
		if resp != nil {
			d, _ = json.Marshal(resp)
		}
		assert.Truef(t, errors.IsForbidden(err), "Response %s", string(d))

		protected := helper.CreateUser("updater+protected", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{accesscontrol.ActionAlertingReceiversRead, accesscontrol.ActionAlertingReceiversUpdate, accesscontrol.ActionAlertingReceiversTestCreate, accesscontrol.ActionAlertingReceiversUpdateProtected},
				Resource:          models.ScopeReceiversRoot,
				ResourceAttribute: "uid",
				ResourceID:        existingReceiver.Name,
			},
		})
		client, err = v0alpha1.NewReceiverClientFromGenerator(protected.GetClientRegistry())
		require.NoError(t, err)

		_, err = client.CreateReceiverIntegrationTest(ctx, existingReceiver.GetStaticMetadata().Identifier(), request)
		require.NoError(t, err)
	})
}

func TestIntegrationTesting(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := getTestHelper(t)

	type request struct {
		path    string
		body    []byte
		headers map[string][]string
	}

	var requests []request
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		rq := request{
			path:    r.URL.Path,
			body:    body,
			headers: maps.Clone(r.Header),
		}
		requests = append(requests, rq)
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(server.Close)

	assertRequest := func(t *testing.T, r request, urlPath, user, password string) {
		t.Helper()
		assert.Equal(t, urlPath, r.path)
		assert.Equal(t, []string{"Basic " + base64.StdEncoding.EncodeToString([]byte(user+":"+password))}, r.headers["Authorization"])
	}

	user := helper.CreateUser("user", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{accesscontrol.ActionAlertingReceiversCreate},
		},
		{
			Actions:           []string{accesscontrol.ActionAlertingReceiversTestCreate},
			Resource:          models.ScopeReceiversRoot,
			ResourceAttribute: "uid",
			ResourceID:        models.NewReceiverScopeID,
		},
	})

	client, err := v0alpha1.NewReceiverClientFromGenerator(user.GetClientRegistry())
	require.NoError(t, err)

	integration := v0alpha1.ReceiverIntegration{
		Type:    "webhook",
		Version: "v1",
		Settings: map[string]interface{}{
			"url":      server.URL,
			"username": "user",
			"password": "secret-password",
		},
	}

	alert := v0alpha1.CreateReceiverIntegrationTestRequestAlert{
		Labels: map[string]string{
			"alertname": "test-alert",
		},
	}

	t.Run("should be able to test a new receiver", func(t *testing.T) {
		requests = nil
		result, err := client.CreateReceiverIntegrationTest(ctx, NoReceiverIdentifier,
			v0alpha1.CreateReceiverIntegrationTestRequest{
				Body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
					Alert: alert,
					Integration: v0alpha1.CreateReceiverIntegrationTestRequestIntegration{
						Type:     integration.Type,
						Version:  integration.Version,
						Settings: integration.Settings,
					},
				},
			})
		require.NoError(t, err)
		assert.Equal(t, v0alpha1.CreateReceiverIntegrationTestBodyStatusSuccess, result.Status)
		require.Len(t, requests, 1)
		assertRequest(t, requests[0], "/", "user", "secret-password")
	})

	receiver, err := client.Create(ctx, &v0alpha1.Receiver{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.ReceiverSpec{
			Title: "test-receiver-1",
			Integrations: []v0alpha1.ReceiverIntegration{
				integration,
			},
		},
	}, resource.CreateOptions{})
	require.NoError(t, err)

	t.Run("should be able to test with changed settings", func(t *testing.T) {
		receiver, err := client.Get(ctx, receiver.GetStaticMetadata().Identifier())
		require.NoError(t, err)
		integration := v0alpha1.CreateReceiverIntegrationTestRequestIntegration(receiver.Spec.Integrations[0])
		integration.Settings["url"] = server.URL + "/changed"
		integration.Settings["password"] = "new-super-secure"
		integration.SecureFields["password"] = false

		requests = nil
		result, err := client.CreateReceiverIntegrationTest(ctx, receiver.GetStaticMetadata().Identifier(), v0alpha1.CreateReceiverIntegrationTestRequest{
			Body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
				Alert:       alert,
				Integration: integration,
			},
		})
		require.NoError(t, err)
		assert.Equal(t, v0alpha1.CreateReceiverIntegrationTestBodyStatusSuccess, result.Status)
		require.Len(t, requests, 1)
		assertRequest(t, requests[0], "/changed", "user", "new-super-secure")
	})

	t.Run("should be able to test a new integration for the existing receiver", func(t *testing.T) {
		requests = nil
		result, err := client.CreateReceiverIntegrationTest(ctx, receiver.GetStaticMetadata().Identifier(), v0alpha1.CreateReceiverIntegrationTestRequest{
			Body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
				Alert: alert,
				Integration: v0alpha1.CreateReceiverIntegrationTestRequestIntegration{
					Type: "webhook",
					Settings: map[string]interface{}{
						"url":      server.URL + "/some-other",
						"username": "user1",
						"password": "test",
					},
				},
			},
		})
		require.NoError(t, err)
		assert.Equal(t, v0alpha1.CreateReceiverIntegrationTestBodyStatusSuccess, result.Status)
		require.Len(t, requests, 1)
		assertRequest(t, requests[0], "/some-other", "user1", "test")
	})

	t.Run("should not be able to test", func(t *testing.T) {
		adminClient, err := v0alpha1.NewReceiverClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
		require.NoError(t, err)

		assertError := func(t *testing.T, predicate func(error) bool, resp *v0alpha1.CreateReceiverIntegrationTestResponse, err error) {
			t.Helper()
			var d []byte
			if resp != nil {
				d, _ = json.Marshal(resp)
			}
			require.Truef(t, predicate(err), "Response %s", string(d))
		}

		t.Run("a new integration with UID specified", func(t *testing.T) {
			receiver, err := client.Get(ctx, receiver.GetStaticMetadata().Identifier())
			integration := v0alpha1.CreateReceiverIntegrationTestRequestIntegration(receiver.Spec.Integrations[0])
			require.NoError(t, err)
			requests = nil
			result, err := adminClient.CreateReceiverIntegrationTest(ctx, NoReceiverIdentifier, v0alpha1.CreateReceiverIntegrationTestRequest{
				Body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
					Alert:       alert,
					Integration: integration,
				},
			})
			assertError(t, errors.IsBadRequest, result, err)
			assert.Empty(t, requests)
		})
		t.Run("an integration with not existing UID", func(t *testing.T) {
			requests = nil
			result, err := adminClient.CreateReceiverIntegrationTest(ctx, receiver.GetStaticMetadata().Identifier(), v0alpha1.CreateReceiverIntegrationTestRequest{
				Body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
					Alert: alert,
					Integration: v0alpha1.CreateReceiverIntegrationTestRequestIntegration{
						Uid:  utils.Pointer("test-uid"),
						Type: "webhook",
						Settings: map[string]interface{}{
							"url":      server.URL + "/some-other",
							"username": "user1",
							"password": "test",
						},
					},
				},
			})
			assertError(t, errors.IsNotFound, result, err)
			assert.Empty(t, requests)
		})
		t.Run("a receiver that does not exist", func(t *testing.T) {
			requests = nil
			result, err := adminClient.CreateReceiverIntegrationTest(ctx,
				resource.Identifier{
					Namespace: "default",
					Name:      "not-existing",
				},
				v0alpha1.CreateReceiverIntegrationTestRequest{
					Body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
						Alert: alert,
						Integration: v0alpha1.CreateReceiverIntegrationTestRequestIntegration{
							Uid:  util.Pointer("test-uid"),
							Type: "webhook",
							Settings: map[string]interface{}{
								"url": server.URL,
							},
						},
					},
				})
			assertError(t, errors.IsNotFound, result, err)
		})
		t.Run("an integration that does not belong to receiver", func(t *testing.T) {
			receiver, err := client.Get(ctx, receiver.GetStaticMetadata().Identifier())
			require.NoError(t, err)
			receiver1Integration := v0alpha1.CreateReceiverIntegrationTestRequestIntegration(receiver.Spec.Integrations[0])

			receiver2, err := client.Create(ctx, &v0alpha1.Receiver{
				ObjectMeta: v1.ObjectMeta{
					Namespace: "default",
				},
				Spec: v0alpha1.ReceiverSpec{
					Title:        "test-receiver-2",
					Integrations: []v0alpha1.ReceiverIntegration{},
				},
			}, resource.CreateOptions{})
			require.NoError(t, err)

			result, err := client.CreateReceiverIntegrationTest(ctx, receiver2.GetStaticMetadata().Identifier(), v0alpha1.CreateReceiverIntegrationTestRequest{
				Body: v0alpha1.CreateReceiverIntegrationTestRequestBody{
					Alert:       alert,
					Integration: receiver1Integration,
				},
			})
			assertError(t, errors.IsNotFound, result, err)
		})
	})
}

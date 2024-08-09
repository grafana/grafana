package receivers

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/grafana/alerting/definition"
	"github.com/grafana/alerting/notify"
	"github.com/prometheus/alertmanager/config"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apis/alerting_notifications/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/api/alerting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
)

const allReceiverName = "all"

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func getTestHelper(t *testing.T) *apis.K8sTestHelper {
	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{
			featuremgmt.FlagAlertingApiServer,
		},
	})
}

func createReceiver(t *testing.T, helper *apis.K8sTestHelper, receiver *v0alpha1.Receiver) *v0alpha1.Receiver {
	cliCfg := helper.Org1.Admin.NewRestConfig()
	legacyCli := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cliCfg.Username, cliCfg.Password)

	for _, integration := range receiver.Spec.Integrations {
		j, err := simplejson.NewJson(integration.Settings)
		require.NoError(t, err)
		legacyCli.EnsureReceiver(t, definitions.EmbeddedContactPoint{
			UID:      "",
			Name:     receiver.Spec.Title,
			Type:     integration.Type,
			Settings: j,
		}, true)
	}

	adminK8sClient, err := versioned.NewForConfig(cliCfg)
	require.NoError(t, err)
	adminClient := adminK8sClient.NotificationsV0alpha1().Receivers("default")

	list, err := adminClient.List(context.Background(), v1.ListOptions{})
	require.NoError(t, err)
	for _, item := range list.Items {
		if item.Spec.Title == receiver.Spec.Title {
			receiver, err := adminClient.Get(context.Background(), item.Name, v1.GetOptions{})
			require.NoError(t, err)
			return receiver
		}
	}
	require.Fail(t, fmt.Sprintf("Cannot create receiver %s. The list operation did not return it", receiver.Spec.Title))
	return nil
}

func TestIntegrationTimeIntervalAccessControl(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	org1 := helper.Org1

	type testCase struct {
		user      apis.User
		canRead   bool
		canUpdate bool
		canCreate bool
		canDelete bool
	}

	lister := helper.CreateUser("ReceiverLister", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingReceiversList,
			},
		},
	})
	reader := helper.CreateUser("ReceiverReader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingReceiversRead,
			},
		},
	})
	legacyReader := helper.CreateUser("NotificationsReader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingNotificationsRead,
			},
		},
	})
	secretsReader := helper.CreateUser("ReceiverSecretsReader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingReceiversReadSecrets,
			},
		},
	})

	writer := helper.CreateUser("IntervalsWriter", "Org1", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingReceiversRead,
				accesscontrol.ActionAlertingNotificationsWrite,
			},
		},
	})

	deleter := helper.CreateUser("IntervalsDeleter", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingReceiversRead,
				accesscontrol.ActionAlertingNotificationsWrite,
			},
		},
	})

	testCases := []testCase{
		{
			user:      org1.Admin,
			canRead:   true,
			canUpdate: true,
			canCreate: true,
			canDelete: true,
		},
		{
			user:      org1.Editor,
			canRead:   true,
			canUpdate: true,
			canCreate: true,
			canDelete: true,
		},
		{
			user:    org1.Viewer,
			canRead: true,
		},
		{
			user:    reader,
			canRead: true,
		},
		{
			user:    legacyReader,
			canRead: true,
		},
		{
			user:    secretsReader,
			canRead: true,
		},
		{
			user:    lister,
			canRead: true,
		},
		{
			user:      writer,
			canRead:   true,
			canCreate: true,
			canUpdate: true,
		},
		{
			user:      deleter,
			canRead:   true,
			canDelete: true,
		},
	}

	admin := org1.Admin
	adminK8sClient, err := versioned.NewForConfig(admin.NewRestConfig())
	require.NoError(t, err)
	adminClient := adminK8sClient.NotificationsV0alpha1().Receivers("default")

	for _, tc := range testCases {
		t.Run(fmt.Sprintf("user '%s'", tc.user.Identity.GetLogin()), func(t *testing.T) {
			k8sClient, err := versioned.NewForConfig(tc.user.NewRestConfig())
			require.NoError(t, err)
			client := k8sClient.NotificationsV0alpha1().Receivers("default")

			var expected = &v0alpha1.Receiver{
				ObjectMeta: v1.ObjectMeta{
					Namespace: "default",
				},
				Spec: v0alpha1.ReceiverSpec{
					Title: fmt.Sprintf("receiver-1-%s", tc.user.Identity.GetLogin()),
					Integrations: []v0alpha1.Integration{
						{
							Settings: json.RawMessage(notify.AllKnownConfigsForTesting["webhook"].Config),
							Type:     "webhook",
						},
					},
				},
			}
			expected = createReceiver(t, helper, expected)

			// if tc.canCreate {
			// 	t.Run("should be able to create receiver", func(t *testing.T) {
			// 		actual, err := client.Create(ctx, expected, v1.CreateOptions{})
			// 		require.NoErrorf(t, err, "Payload %s", string(d))
			// 		require.Equal(t, expected.Spec, actual.Spec)
			//
			// 		t.Run("should fail if already exists", func(t *testing.T) {
			// 			_, err := client.Create(ctx, actual, v1.CreateOptions{})
			// 			require.Truef(t, errors.IsBadRequest(err), "expected bad request but got %s", err)
			// 		})
			//
			// 		expected = actual
			// 	})
			// } else {
			// 	t.Run("should be forbidden to create", func(t *testing.T) {
			// 		_, err := client.Create(ctx, expected, v1.CreateOptions{})
			// 		require.Truef(t, errors.IsForbidden(err), "Payload %s", string(d))
			// 	})
			//
			// 	// create resource to proceed with other tests
			// 	expected, err = adminClient.Create(ctx, expected, v1.CreateOptions{})
			// 	require.NoErrorf(t, err, "Payload %s", string(d))
			// 	require.NotNil(t, expected)
			// }

			if tc.canRead {
				t.Run("should be able to list receivers", func(t *testing.T) {
					list, err := client.List(ctx, v1.ListOptions{})
					require.NoError(t, err)
					require.Len(t, list.Items, 2) // default + created
				})

				t.Run("should be able to read receiver by resource identifier", func(t *testing.T) {
					got, err := client.Get(ctx, expected.Name, v1.GetOptions{})
					require.NoError(t, err)
					require.Equal(t, expected, got)

					t.Run("should get NotFound if resource does not exist", func(t *testing.T) {
						_, err := client.Get(ctx, "Notfound", v1.GetOptions{})
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			} else {
				t.Run("should be forbidden to list receivers", func(t *testing.T) {
					_, err := client.List(ctx, v1.ListOptions{})
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
				})

				t.Run("should be forbidden to read receiver by name", func(t *testing.T) {
					_, err := client.Get(ctx, expected.Name, v1.GetOptions{})
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should get forbidden even if name does not exist", func(t *testing.T) {
						_, err := client.Get(ctx, "Notfound", v1.GetOptions{})
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
			}

			// updatedExpected := expected.DeepCopy()
			// updatedExpected.Spec.Integrations. = v0alpha1.IntervalGenerator{}.GenerateMany(2)
			//
			// d, err = json.Marshal(updatedExpected)
			// require.NoError(t, err)
			//
			// if tc.canUpdate {
			// 	t.Run("should be able to update receiver", func(t *testing.T) {
			// 		updated, err := client.Update(ctx, updatedExpected, v1.UpdateOptions{})
			// 		require.NoErrorf(t, err, "Payload %s", string(d))
			//
			// 		expected = updated
			//
			// 		t.Run("should get NotFound if name does not exist", func(t *testing.T) {
			// 			up := updatedExpected.DeepCopy()
			// 			up.Name = "notFound"
			// 			_, err := client.Update(ctx, up, v1.UpdateOptions{})
			// 			require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
			// 		})
			// 	})
			// } else {
			// 	t.Run("should be forbidden to update receiver", func(t *testing.T) {
			// 		_, err := client.Update(ctx, updatedExpected, v1.UpdateOptions{})
			// 		require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
			//
			// 		t.Run("should get forbidden even if resource does not exist", func(t *testing.T) {
			// 			up := updatedExpected.DeepCopy()
			// 			up.Name = "notFound"
			// 			_, err := client.Update(ctx, up, v1.UpdateOptions{})
			// 			require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
			// 		})
			// 	})
			// }

			deleteOptions := v1.DeleteOptions{Preconditions: &v1.Preconditions{ResourceVersion: util.Pointer(expected.ResourceVersion)}}

			if tc.canDelete {
				t.Run("should be able to delete receiver", func(t *testing.T) {
					err := client.Delete(ctx, expected.Name, deleteOptions)
					require.NoError(t, err)

					t.Run("should get NotFound if name does not exist", func(t *testing.T) {
						err := client.Delete(ctx, "notfound", v1.DeleteOptions{})
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			} else {
				t.Run("should be forbidden to delete receiver", func(t *testing.T) {
					err := client.Delete(ctx, expected.Name, deleteOptions)
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should be forbidden even if resource does not exist", func(t *testing.T) {
						err := client.Delete(ctx, "notfound", v1.DeleteOptions{})
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
				require.NoError(t, adminClient.Delete(ctx, expected.Name, v1.DeleteOptions{}))
			}

			if tc.canRead {
				t.Run("should get empty list if no mute timings", func(t *testing.T) {
					list, err := client.List(ctx, v1.ListOptions{})
					require.NoError(t, err)
					require.Len(t, list.Items, 1)
				})
			}
		})
	}
}

func TestIntegrationReceiverProvisioning(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	org := helper.Org1

	admin := org.Admin
	adminK8sClient, err := versioned.NewForConfig(admin.NewRestConfig())
	require.NoError(t, err)
	adminClient := adminK8sClient.NotificationsV0alpha1().Receivers("default")

	env := helper.GetEnv()
	ac := acimpl.ProvideAccessControl(env.FeatureToggles, zanzana.NewNoopClient())
	db, err := store.ProvideDBStore(env.Cfg, env.FeatureToggles, env.SQLStore, &foldertest.FakeService{}, &dashboards.FakeDashboardService{}, ac)
	require.NoError(t, err)

	created := createReceiver(t, helper, &v0alpha1.Receiver{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.ReceiverSpec{
			Title: "test-receiver-1",
			Integrations: []v0alpha1.Integration{
				{
					Settings: json.RawMessage(notify.AllKnownConfigsForTesting["webhook"].Config),
					Type:     "webhook",
				},
			},
		},
	})
	require.NoError(t, err)
	require.Equal(t, "none", created.GetProvenanceStatus())

	t.Run("should provide provenance status", func(t *testing.T) {
		require.NoError(t, db.SetProvenance(ctx, &definitions.EmbeddedContactPoint{
			UID: *created.Spec.Integrations[0].Uid,
		}, admin.Identity.GetOrgID(), "API"))

		got, err := adminClient.Get(ctx, created.Name, v1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "API", got.GetProvenanceStatus())
	})
	// t.Run("should not let update if provisioned", func(t *testing.T) {
	// 	updated := created.DeepCopy()
	// 	updated.Spec.Integrations = append(updated.Spec.Integrations, v0alpha1.Integration{
	// 		Settings: json.RawMessage(notify.AllKnownConfigsForTesting["webhook"].Config),
	// 		Type:     "webhook",
	// 	})
	//
	// 	_, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
	// 	require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
	// })

	t.Run("should not let delete if provisioned", func(t *testing.T) {
		err := adminClient.Delete(ctx, created.Name, v1.DeleteOptions{})
		require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
	})
}

package receivers

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"path"
	"slices"
	"sort"
	"strings"
	"testing"

	"github.com/grafana/alerting/notify"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/alerting_notifications/v0alpha1"
	"github.com/grafana/grafana/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/ngalert/api"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels_config"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/api/alerting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
)

//go:embed test-data/*.*
var testData embed.FS

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

func TestIntegrationResourceIdentifier(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)
	adminK8sClient, err := versioned.NewForConfig(helper.Org1.Admin.NewRestConfig())
	require.NoError(t, err)
	client := adminK8sClient.NotificationsV0alpha1().Receivers("default")

	newResource := &v0alpha1.Receiver{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.ReceiverSpec{
			Title:        "Test-Receiver",
			Integrations: nil,
		},
	}

	t.Run("create should fail if object name is specified", func(t *testing.T) {
		resource := newResource.DeepCopy()
		resource.Name = "new-receiver"
		_, err := client.Create(ctx, resource, v1.CreateOptions{})
		require.Truef(t, errors.IsBadRequest(err), "Expected BadRequest but got %s", err)
	})

	var resourceID string
	t.Run("create should succeed and provide resource name", func(t *testing.T) {
		actual, err := client.Create(ctx, newResource, v1.CreateOptions{})
		require.NoError(t, err)
		require.NotEmptyf(t, actual.Name, "Resource name should not be empty")
		require.NotEmptyf(t, actual.UID, "Resource UID should not be empty")
		resourceID = actual.Name
	})

	t.Run("resource should be available by the identifier", func(t *testing.T) {
		actual, err := client.Get(ctx, resourceID, v1.GetOptions{})
		require.NoError(t, err)
		require.NotEmptyf(t, actual.Name, "Resource name should not be empty")
		require.Equal(t, newResource.Spec, actual.Spec)
	})

	// TODO uncomment when renaming is supported
	// t.Run("update should rename receiver if name in the specification changes", func(t *testing.T) {
	// 	existing, err := client.Get(ctx, resourceID, v1.GetOptions{})
	// 	require.NoError(t, err)
	//
	// 	updated := existing.DeepCopy()
	// 	updated.Spec.Title = "another-newReceiver"
	//
	// 	actual, err := client.Update(ctx, updated, v1.UpdateOptions{})
	// 	require.NoError(t, err)
	// 	require.Equal(t, updated.Spec, actual.Spec)
	// 	require.NotEqualf(t, updated.Name, actual.Name, "Update should change the resource name but it didn't")
	// 	require.NotEqualf(t, updated.ResourceVersion, actual.ResourceVersion, "Update should change the resource version but it didn't")
	//
	// 	resource, err := client.Get(ctx, actual.Name, v1.GetOptions{})
	// 	require.NoError(t, err)
	// 	require.Equal(t, actual, resource)
	// })
}

func TestIntegrationAccessControl(t *testing.T) {
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
	// region users
	unauthorized := helper.CreateUser("unauthorized", "Org1", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{})

	reader := helper.CreateUser("reader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		createWildcardPermission(accesscontrol.ActionAlertingReceiversRead),
	})
	secretsReader := helper.CreateUser("secretsReader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		createWildcardPermission(accesscontrol.ActionAlertingReceiversReadSecrets),
	})
	creator := helper.CreateUser("creator", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		createWildcardPermission(
			accesscontrol.ActionAlertingReceiversRead,
			accesscontrol.ActionAlertingReceiversCreate,
		),
	})
	updater := helper.CreateUser("updater", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		createWildcardPermission(
			accesscontrol.ActionAlertingReceiversRead,
			accesscontrol.ActionAlertingReceiversUpdate,
		),
	})
	deleter := helper.CreateUser("deleter", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		createWildcardPermission(
			accesscontrol.ActionAlertingReceiversRead,
			accesscontrol.ActionAlertingReceiversDelete,
		),
	})
	legacyReader := helper.CreateUser("legacyReader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingNotificationsRead,
			},
		},
	})
	legacyWriter := helper.CreateUser("legacyWriter", "Org1", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingNotificationsRead,
				accesscontrol.ActionAlertingNotificationsWrite,
			},
		},
	})

	// endregion

	testCases := []testCase{
		{
			user:      unauthorized,
			canRead:   false,
			canUpdate: false,
			canCreate: false,
			canDelete: false,
		},
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
			user:    secretsReader,
			canRead: true,
		},
		{
			user:      creator,
			canRead:   true,
			canCreate: true,
		},
		{
			user:      updater,
			canRead:   true,
			canUpdate: true,
		},
		{
			user:      deleter,
			canRead:   true,
			canDelete: true,
		},
		{
			user:    legacyReader,
			canRead: true,
		},
		{
			user:      legacyWriter,
			canRead:   true,
			canCreate: true,
			canUpdate: true,
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
					Title:        fmt.Sprintf("receiver-1-%s", tc.user.Identity.GetLogin()),
					Integrations: nil,
				},
			}
			d, err := json.Marshal(expected)
			require.NoError(t, err)

			if tc.canCreate {
				t.Run("should be able to create receiver", func(t *testing.T) {
					newReceiver := expected

					actual, err := client.Create(ctx, newReceiver, v1.CreateOptions{})
					require.NoErrorf(t, err, "Payload %s", string(d))

					require.Equal(t, expected.Spec, actual.Spec)

					t.Run("should fail if already exists", func(t *testing.T) {
						_, err := client.Create(ctx, newReceiver, v1.CreateOptions{})
						require.Truef(t, errors.IsConflict(err), "expected  bad request but got %s", err)
					})

					expected = actual
				})
			} else {
				t.Run("should be forbidden to create", func(t *testing.T) {
					_, err := client.Create(ctx, expected, v1.CreateOptions{})
					require.Truef(t, errors.IsForbidden(err), "Payload %s", string(d))
				})

				// create resource to proceed with other tests
				expected, err = adminClient.Create(ctx, expected, v1.CreateOptions{})
				require.NoErrorf(t, err, "Payload %s", string(d))
				require.NotNil(t, expected)
			}

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

			updatedExpected := expected.DeepCopy()
			updatedExpected.Spec.Integrations = append(updatedExpected.Spec.Integrations, createIntegration(t, "email"))

			d, err = json.Marshal(updatedExpected)
			require.NoError(t, err)

			if tc.canUpdate {
				t.Run("should be able to update receiver", func(t *testing.T) {
					updated, err := client.Update(ctx, updatedExpected, v1.UpdateOptions{})
					require.NoErrorf(t, err, "Payload %s", string(d))

					expected = updated

					t.Run("should get NotFound if name does not exist", func(t *testing.T) {
						up := updatedExpected.DeepCopy()
						up.Name = "notFound"
						_, err := client.Update(ctx, up, v1.UpdateOptions{})
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			} else {
				t.Run("should be forbidden to update receiver", func(t *testing.T) {
					_, err := client.Update(ctx, updatedExpected, v1.UpdateOptions{})
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should get forbidden even if resource does not exist", func(t *testing.T) {
						up := updatedExpected.DeepCopy()
						up.Name = "notFound"
						_, err := client.Update(ctx, up, v1.UpdateOptions{})
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
			}

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
				t.Run("should get empty list if no receivers", func(t *testing.T) {
					list, err := client.List(ctx, v1.ListOptions{})
					require.NoError(t, err)
					require.Len(t, list.Items, 1)
				})
			}
		})
	}
}

func TestIntegrationProvisioning(t *testing.T) {
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

	created, err := adminClient.Create(ctx, &v0alpha1.Receiver{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.ReceiverSpec{
			Title: "test-receiver-1",
			Integrations: []v0alpha1.Integration{
				createIntegration(t, "email"),
			},
		},
	}, v1.CreateOptions{})
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

	t.Run("should not let update if provisioned", func(t *testing.T) {
		got, err := adminClient.Get(ctx, created.Name, v1.GetOptions{})
		require.NoError(t, err)
		updated := got.DeepCopy()
		updated.Spec.Integrations = append(updated.Spec.Integrations, createIntegration(t, "email"))

		_, err = adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
	})

	t.Run("should not let delete if provisioned", func(t *testing.T) {
		err := adminClient.Delete(ctx, created.Name, v1.DeleteOptions{})
		require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
	})
}

func TestIntegrationOptimisticConcurrency(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	adminK8sClient, err := versioned.NewForConfig(helper.Org1.Admin.NewRestConfig())
	require.NoError(t, err)
	adminClient := adminK8sClient.NotificationsV0alpha1().Receivers("default")

	receiver := v0alpha1.Receiver{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.ReceiverSpec{
			Title:        "receiver-1",
			Integrations: nil,
		},
	}

	created, err := adminClient.Create(ctx, &receiver, v1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, created)
	require.NotEmpty(t, created.ResourceVersion)

	t.Run("should forbid if version does not match", func(t *testing.T) {
		updated := created.DeepCopy()
		updated.ResourceVersion = "test"
		_, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.Truef(t, errors.IsConflict(err), "should get Forbidden error but got %s", err)
	})
	t.Run("should update if version matches", func(t *testing.T) {
		updated := created.DeepCopy()
		updated.Spec.Integrations = append(updated.Spec.Integrations, createIntegration(t, "email"))
		actualUpdated, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.NoError(t, err)
		for i, integration := range actualUpdated.Spec.Integrations {
			updated.Spec.Integrations[i].Uid = integration.Uid
		}
		require.EqualValues(t, updated.Spec, actualUpdated.Spec)
		require.NotEqual(t, updated.ResourceVersion, actualUpdated.ResourceVersion)
	})
	t.Run("should fail to update if version is empty", func(t *testing.T) {
		updated := created.DeepCopy()
		updated.ResourceVersion = ""
		updated.Spec.Integrations = append(updated.Spec.Integrations, createIntegration(t, "webhook"))
		_, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.Truef(t, errors.IsConflict(err), "should get Forbidden error but got %s", err) // TODO Change that? K8s returns 400 instead.
	})
	t.Run("should fail to delete if version does not match", func(t *testing.T) {
		actual, err := adminClient.Get(ctx, created.Name, v1.GetOptions{})
		require.NoError(t, err)

		err = adminClient.Delete(ctx, actual.Name, v1.DeleteOptions{
			Preconditions: &v1.Preconditions{
				ResourceVersion: util.Pointer("something"),
			},
		})
		require.Truef(t, errors.IsConflict(err), "should get Forbidden error but got %s", err)
	})
	t.Run("should succeed if version matches", func(t *testing.T) {
		actual, err := adminClient.Get(ctx, created.Name, v1.GetOptions{})
		require.NoError(t, err)

		err = adminClient.Delete(ctx, actual.Name, v1.DeleteOptions{
			Preconditions: &v1.Preconditions{
				ResourceVersion: util.Pointer(actual.ResourceVersion),
			},
		})
		require.NoError(t, err)
	})
	t.Run("should succeed if version is empty", func(t *testing.T) {
		actual, err := adminClient.Create(ctx, &receiver, v1.CreateOptions{})
		require.NoError(t, err)

		err = adminClient.Delete(ctx, actual.Name, v1.DeleteOptions{
			Preconditions: &v1.Preconditions{
				ResourceVersion: util.Pointer(actual.ResourceVersion),
			},
		})
		require.NoError(t, err)
	})
}

func TestIntegrationPatch(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	adminK8sClient, err := versioned.NewForConfig(helper.Org1.Admin.NewRestConfig())
	require.NoError(t, err)
	adminClient := adminK8sClient.NotificationsV0alpha1().Receivers("default")

	receiver := v0alpha1.Receiver{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.ReceiverSpec{
			Title: "receiver",
			Integrations: []v0alpha1.Integration{
				createIntegration(t, "email"),
				createIntegration(t, "webhook"),
				createIntegration(t, "sns"),
			},
		},
	}

	current, err := adminClient.Create(ctx, &receiver, v1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, current)

	t.Run("should patch with json patch", func(t *testing.T) {
		current, err := adminClient.Get(ctx, current.Name, v1.GetOptions{})
		require.NoError(t, err)

		index := slices.IndexFunc(current.Spec.Integrations, func(t v0alpha1.Integration) bool {
			return t.Type == "webhook"
		})

		patch := []map[string]any{
			{
				"op":   "remove",
				"path": fmt.Sprintf("/spec/integrations/%d/settings/username", index),
			},
			{
				"op":   "remove",
				"path": fmt.Sprintf("/spec/integrations/%d/secureFields/password", index),
			},
			{
				"op":    "replace",
				"path":  fmt.Sprintf("/spec/integrations/%d/settings/authorization_scheme", index),
				"value": "bearer",
			},
			{
				"op":    "add",
				"path":  fmt.Sprintf("/spec/integrations/%d/settings/authorization_credentials", index),
				"value": "authz-token",
			},
			{
				"op":   "remove",
				"path": fmt.Sprintf("/spec/integrations/%d/secureFields/authorization_credentials", index),
			},
		}

		expected := current.Spec.Integrations[index]
		expected.Settings.Remove("username")
		expected.Settings.Remove("password")
		expected.Settings.Set("authorization_scheme", "bearer")
		delete(expected.SecureFields, "password")
		expected.SecureFields["authorization_credentials"] = true

		patchData, err := json.Marshal(patch)
		require.NoError(t, err)

		result, err := adminClient.Patch(ctx, current.Name, types.JSONPatchType, patchData, v1.PatchOptions{})
		require.NoError(t, err)

		require.EqualValues(t, expected, result.Spec.Integrations[index])

		// Use export endpoint because it's the only way to get decrypted secrets fast.
		cliCfg := helper.Org1.Admin.NewRestConfig()
		legacyCli := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cliCfg.Username, cliCfg.Password)

		export := legacyCli.ExportReceiverTyped(t, current.Spec.Title, true)
		// we need special unmarshaler to parse settings
		cp, err := api.ContactPointFromContactPointExport(export)
		require.NoError(t, err)

		assert.Len(t, cp.Sns, 1)
		assert.Len(t, cp.Email, 1)
		require.Len(t, cp.Webhook, 1)

		settings := cp.Webhook[0]
		assert.EqualValues(t, "authz-token", *settings.AuthorizationCredentials)
		assert.EqualValues(t, "bearer", *settings.AuthorizationScheme)
		assert.Nil(t, settings.Password)
		assert.Nil(t, settings.User)
	})
}

func TestIntegrationReferentialIntegrity(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)
	// env := helper.GetEnv()
	// ac := acimpl.ProvideAccessControl(env.FeatureToggles, zanzana.NewNoopClient())
	// db, err := store.ProvideDBStore(env.Cfg, env.FeatureToggles, env.SQLStore, &foldertest.FakeService{}, &dashboards.FakeDashboardService{}, ac)
	// require.NoError(t, err)
	// orgID := helper.Org1.Admin.Identity.GetOrgID()

	cliCfg := helper.Org1.Admin.NewRestConfig()
	legacyCli := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cliCfg.Username, cliCfg.Password)

	// Prepare environment and create notification policy and rule that use time receiver
	alertmanagerRaw, err := testData.ReadFile(path.Join("test-data", "notification-settings.json"))
	require.NoError(t, err)
	var amConfig definitions.PostableUserConfig
	require.NoError(t, json.Unmarshal(alertmanagerRaw, &amConfig))

	success, err := legacyCli.PostConfiguration(t, amConfig)
	require.Truef(t, success, "Failed to post Alertmanager configuration: %s", err)

	postGroupRaw, err := testData.ReadFile(path.Join("test-data", "rulegroup-1.json"))
	require.NoError(t, err)
	var ruleGroup definitions.PostableRuleGroupConfig
	require.NoError(t, json.Unmarshal(postGroupRaw, &ruleGroup))

	folderUID := "test-folder"
	legacyCli.CreateFolder(t, folderUID, "TEST")
	_, status, data := legacyCli.PostRulesGroupWithStatus(t, folderUID, &ruleGroup)
	require.Equalf(t, http.StatusAccepted, status, "Failed to post Rule: %s", data)

	adminK8sClient, err := versioned.NewForConfig(cliCfg)
	require.NoError(t, err)
	adminClient := adminK8sClient.NotificationsV0alpha1().Receivers("default")

	receivers, err := adminClient.List(ctx, v1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, receivers.Items, 2)
	idx := slices.IndexFunc(receivers.Items, func(interval v0alpha1.Receiver) bool {
		return interval.Spec.Title == "user-defined"
	})
	receiver := receivers.Items[idx]

	// TODO uncomment when renaming is enabled
	// currentRoute := legacyCli.GetRoute(t)
	// currentRuleGroup := legacyCli.GetRulesGroup(t, folderUID, ruleGroup.Name)
	// replace := func(input []string, oldName, newName string) []string {
	// 	result := make([]string, 0, len(input))
	// 	for _, s := range input {
	// 		if s == oldName {
	// 			result = append(result, newName)
	// 			continue
	// 		}
	// 		result = append(result, s)
	// 	}
	// 	return result
	// }
	//
	// t.Run("Update", func(t *testing.T) {
	// 	t.Run("should rename all references if name changes", func(t *testing.T) {
	// 		renamed := receiver.DeepCopy()
	// 		expectedTitle := renamed.Spec.Title + "-new"
	// 		renamed.Spec.Title += expectedTitle
	//
	// 		actual, err := adminClient.Update(ctx, renamed, v1.UpdateOptions{})
	// 		require.NoError(t, err)
	//
	// 		updatedRuleGroup := legacyCli.GetRulesGroup(t, folderUID, ruleGroup.Name)
	// 		for idx, rule := range updatedRuleGroup.Rules {
	// 			assert.Equalf(t, expectedTitle, rule.GrafanaManagedAlert.NotificationSettings.Receiver, "receiver in rule %d should have been renamed but it did not", idx)
	// 		}
	//
	// 		updatedRoute := legacyCli.GetRoute(t)
	// 		for _, route := range updatedRoute.Routes {
	// 			assert.Equalf(t, expectedTitle, route.Receiver, "time receiver in routes should have been renamed but it did not")
	// 		}
	// 		receiver = *actual
	// 	})
	//
	// 	t.Run("should fail if at least one resource is provisioned", func(t *testing.T) {
	// 		require.NoError(t, err)
	// 		renamed := receiver.DeepCopy()
	// 		renamed.Spec.Title += util.GenerateShortUID()
	//
	// 		t.Run("provisioned route", func(t *testing.T) {
	// 			require.NoError(t, db.SetProvenance(ctx, &currentRoute, orgID, "API"))
	// 			t.Cleanup(func() {
	// 				require.NoError(t, db.DeleteProvenance(ctx, &currentRoute, orgID))
	// 			})
	// 			actual, err := adminClient.Update(ctx, renamed, v1.UpdateOptions{})
	// 			require.Errorf(t, err, "Expected error but got successful result: %v", actual)
	// 			require.Truef(t, errors.IsConflict(err), "Expected Conflict, got: %s", err)
	// 		})
	//
	// 		t.Run("provisioned rules", func(t *testing.T) {
	// 			ruleUid := currentRuleGroup.Rules[0].GrafanaManagedAlert.UID
	// 			resource := &ngmodels.AlertRule{UID: ruleUid}
	// 			require.NoError(t, db.SetProvenance(ctx, resource, orgID, "API"))
	// 			t.Cleanup(func() {
	// 				require.NoError(t, db.DeleteProvenance(ctx, resource, orgID))
	// 			})
	//
	// 			actual, err := adminClient.Update(ctx, renamed, v1.UpdateOptions{})
	// 			require.Errorf(t, err, "Expected error but got successful result: %v", actual)
	// 			require.Truef(t, errors.IsConflict(err), "Expected Conflict, got: %s", err)
	// 		})
	// 	})
	// })

	t.Run("Delete", func(t *testing.T) {
		t.Run("should fail to delete if receiver is used in rule and routes", func(t *testing.T) {
			err := adminClient.Delete(ctx, receiver.Name, v1.DeleteOptions{})
			require.Truef(t, errors.IsConflict(err), "Expected Conflict, got: %s", err)
		})

		t.Run("should fail to delete if receiver is used in only rule", func(t *testing.T) {
			route := legacyCli.GetRoute(t)
			route.Routes[0].Receiver = ""
			legacyCli.UpdateRoute(t, route, true)

			err = adminClient.Delete(ctx, receiver.Name, v1.DeleteOptions{})
			require.Truef(t, errors.IsConflict(err), "Expected Conflict, got: %s", err)
		})
	})
}

func TestIntegrationCRUD(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	adminK8sClient, err := versioned.NewForConfig(helper.Org1.Admin.NewRestConfig())
	require.NoError(t, err)
	adminClient := adminK8sClient.NotificationsV0alpha1().Receivers("default")

	var defaultReceiver *v0alpha1.Receiver
	t.Run("should list the default receiver", func(t *testing.T) {
		items, err := adminClient.List(ctx, v1.ListOptions{})
		require.NoError(t, err)
		assert.Len(t, items.Items, 1)
		defaultReceiver = &items.Items[0]
		assert.Equal(t, "grafana-default-email", defaultReceiver.Spec.Title)
		assert.NotEmpty(t, defaultReceiver.UID)
		assert.NotEmpty(t, defaultReceiver.Name)
		assert.NotEmpty(t, defaultReceiver.ResourceVersion)

		defaultReceiver, err = adminClient.Get(ctx, defaultReceiver.Name, v1.GetOptions{})
		require.NoError(t, err)
		assert.NotEmpty(t, defaultReceiver.UID)
		assert.NotEmpty(t, defaultReceiver.Name)
		assert.NotEmpty(t, defaultReceiver.ResourceVersion)
		assert.Len(t, defaultReceiver.Spec.Integrations, 1)
	})

	t.Run("should be able to update default receiver", func(t *testing.T) {
		require.NotNil(t, defaultReceiver)
		newDefault := defaultReceiver.DeepCopy()
		newDefault.Spec.Integrations = append(newDefault.Spec.Integrations, createIntegration(t, "line"))

		updatedReceiver, err := adminClient.Update(ctx, newDefault, v1.UpdateOptions{})
		require.NoError(t, err)

		expected := newDefault.DeepCopy()
		expected.Spec.Integrations[0].Uid = updatedReceiver.Spec.Integrations[0].Uid // default integration does not have UID before first update
		lineIntegration := expected.Spec.Integrations[1]
		lineIntegration.SecureFields = map[string]bool{
			"token": true,
		}
		lineIntegration.Settings.Remove("token")
		assert.Equal(t, "LINE", updatedReceiver.Spec.Integrations[1].Type) // this type is in the schema but not in backend
		lineIntegration.Type = "LINE"
		lineIntegration.Uid = updatedReceiver.Spec.Integrations[1].Uid
		expected.Spec.Integrations[1] = lineIntegration

		assert.Equal(t, expected.Spec, updatedReceiver.Spec)
	})

	t.Run("should fail to create receiver with the existing name", func(t *testing.T) {
		newReceiver := &v0alpha1.Receiver{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
			},
			Spec: v0alpha1.ReceiverSpec{
				Title:        defaultReceiver.Spec.Title,
				Integrations: nil,
			},
		}
		_, err := adminClient.Create(ctx, newReceiver, v1.CreateOptions{})
		require.Truef(t, errors.IsConflict(err), "Expected Conflict, got: %s", err)
	})

	t.Run("should not let delete default receiver", func(t *testing.T) {
		err := adminClient.Delete(ctx, defaultReceiver.Name, v1.DeleteOptions{})
		require.Truef(t, errors.IsConflict(err), "Expected Conflict, got: %s", err)
	})

	var receiver *v0alpha1.Receiver
	t.Run("should correctly persist all known integrations", func(t *testing.T) {
		integrations := make([]v0alpha1.Integration, 0, len(notify.AllKnownConfigsForTesting))
		keysIter := maps.Keys(notify.AllKnownConfigsForTesting)
		keys := slices.Collect(keysIter)
		sort.Strings(keys)
		for _, key := range keys {
			integrations = append(integrations, createIntegration(t, key))
		}

		receiver, err = adminClient.Create(ctx, &v0alpha1.Receiver{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
			},
			Spec: v0alpha1.ReceiverSpec{
				Title:        "all-receivers",
				Integrations: integrations,
			},
		}, v1.CreateOptions{})
		require.NoError(t, err)
		require.Len(t, receiver.Spec.Integrations, len(integrations))

		// Use export endpoint because it's the only way to get decrypted secrets fast.
		cliCfg := helper.Org1.Admin.NewRestConfig()
		legacyCli := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cliCfg.Username, cliCfg.Password)

		export := legacyCli.ExportReceiverTyped(t, receiver.Spec.Title, true)
		for _, integration := range export.Receivers {
			expected := notify.AllKnownConfigsForTesting[strings.ToLower(integration.Type)] // to lower because there is LINE that is in different casing in API
			assert.JSONEqf(t, expected.Config, string(integration.Settings), "integration %s", integration.Type)
		}
	})

	t.Run("should be able read what it is created", func(t *testing.T) {
		get, err := adminClient.Get(ctx, receiver.Name, v1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, receiver, get)
		t.Run("should return secrets in secureFields but not settings", func(t *testing.T) {
			for _, integration := range get.Spec.Integrations {
				t.Run(integration.Type, func(t *testing.T) {
					secretFields, err := channels_config.GetSecretKeysForContactPointType(integration.Type)
					require.NoError(t, err)
					for _, field := range secretFields {
						assert.Contains(t, integration.SecureFields, field)
						assert.Truef(t, integration.SecureFields[field], "secure field should be always true")

						value, ok, err := unstructured.NestedString(integration.Settings.Object, strings.Split(field, ".")...)
						assert.NoErrorf(t, err, "failed to read field %s from settings", field)
						assert.Falsef(t, ok, "secret field %s should not be in settings, value [%s]", field, value)
					}
				})
			}
		})
	})

	t.Run("should fail to persist receiver with invalid config", func(t *testing.T) {
		keysIter := maps.Keys(notify.AllKnownConfigsForTesting)
		keys := slices.Collect(keysIter)
		sort.Strings(keys)
		for _, key := range keys {
			t.Run(key, func(t *testing.T) {
				integration := createIntegration(t, key)
				// Make the integration invalid, so it fails to create. This is usually done by sending empty settings.
				clear(integration.Settings.Object)
				if key == "webex" {
					// Webex integration is special case and passes validation without any settings so we instead set an invalid URL.
					integration.Settings.Set("api_url", "(*^$*^%!@#$*()")
				}

				receiver, err = adminClient.Create(ctx, &v0alpha1.Receiver{
					ObjectMeta: v1.ObjectMeta{
						Namespace: "default",
					},
					Spec: v0alpha1.ReceiverSpec{
						Title:        fmt.Sprintf("invalid-%s", key),
						Integrations: []v0alpha1.Integration{integration},
					},
				}, v1.CreateOptions{})
				require.Errorf(t, err, "Expected error but got successful result: %v", receiver)
				require.Truef(t, errors.IsBadRequest(err), "Expected BadRequest, got: %s", err)
			})
		}
	})
}

func createIntegration(t *testing.T, integrationType string) v0alpha1.Integration {
	cfg, ok := notify.AllKnownConfigsForTesting[integrationType]
	require.Truef(t, ok, "no known config for integration type %s", integrationType)
	settings := common.Unstructured{}
	require.NoError(t, settings.UnmarshalJSON([]byte(cfg.Config)))
	return v0alpha1.Integration{
		Settings:              settings,
		Type:                  cfg.NotifierType,
		DisableResolveMessage: util.Pointer(false),
	}
}

func createWildcardPermission(actions ...string) resourcepermissions.SetResourcePermissionCommand {
	return resourcepermissions.SetResourcePermissionCommand{
		Actions:           actions,
		Resource:          "receivers",
		ResourceAttribute: "uid",
		ResourceID:        "*",
	}
}

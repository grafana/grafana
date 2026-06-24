package config

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana-app-sdk/resource"

	alertingnotifv0alpha1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// singletonID is the only valid identifier for the per-org Config singleton.
var singletonID = resource.Identifier{
	Namespace: apis.DefaultNamespace,
	Name:      alertingnotifv0alpha1.ConfigSingletonName,
}

// configGVR is the GroupVersionResource for the Config kind, used by the raw
// dynamic client below.
var configGVR = schema.GroupVersionResource{
	Group:    alertingnotifv0alpha1.APIGroup,
	Version:  alertingnotifv0alpha1.APIVersion,
	Resource: "configs",
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// getTestHelper boots an in-process Grafana with the external-alertmanager sync
// feature flag enabled. The flag is required for the datasource admission
// validator to run (with it off the validator short-circuits with "sync is
// disabled"); see newExternalSyncDatasourceValidator in
// pkg/registry/apps/alerting/notifications/register.go.
func getTestHelper(t *testing.T) *apis.K8sTestHelper {
	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{
			featuremgmt.FlagAlertingSyncExternalAlertmanager,
		},
	})
}

func ptr[T any](v T) *T { return &v }

func newConfigClient(t *testing.T, user apis.User) *alertingnotifv0alpha1.ConfigClient {
	t.Helper()
	client, err := alertingnotifv0alpha1.NewConfigClientFromGenerator(user.GetClientRegistry())
	require.NoError(t, err)
	return client
}

// rawConfigClient returns a dynamic client for Config in the default namespace.
// Unlike the generated ConfigClient, the dynamic client's Update issues a direct
// PUT without first GETting the object, so it can exercise the server-side
// create-on-update (upsert) path for the not-yet-existing singleton.
func rawConfigClient(t *testing.T, user apis.User) dynamic.ResourceInterface {
	t.Helper()
	return user.ResourceClient(t, configGVR).Namespace(apis.DefaultNamespace)
}

// rawUpdate PUTs cfg via the dynamic client (create-on-update capable).
func rawUpdate(t *testing.T, ctx context.Context, user apis.User, cfg *alertingnotifv0alpha1.Config) (*alertingnotifv0alpha1.Config, error) {
	t.Helper()
	obj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(cfg)
	require.NoError(t, err)
	res, err := rawConfigClient(t, user).Update(ctx, &unstructured.Unstructured{Object: obj}, v1.UpdateOptions{})
	if err != nil {
		return nil, err
	}
	out := &alertingnotifv0alpha1.Config{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(res.Object, out))
	return out, nil
}

// newConfig builds a Config resource with the given name. ExternalAlertmanagerSync
// is left unset, which is always valid (clearing/omitting is never rejected by
// the admission validator).
func newConfig(name string) *alertingnotifv0alpha1.Config {
	return &alertingnotifv0alpha1.Config{
		TypeMeta: v1.TypeMeta{
			Kind:       alertingnotifv0alpha1.ConfigKind().Kind(),
			APIVersion: alertingnotifv0alpha1.GroupVersion.Identifier(),
		},
		ObjectMeta: v1.ObjectMeta{
			Namespace: apis.DefaultNamespace,
			Name:      name,
		},
		Spec: alertingnotifv0alpha1.ConfigSpec{},
	}
}

// seedSingleton brings the "default" singleton into existence the way production
// does — by driving the sync worker's flag-on-but-unconfigured pass, which seeds
// it. Human create is denied, so this is the only way to get an existing object
// for the read/update tests. The pass is re-run until the singleton is readable to
// absorb boot-time ordering (the seed pass skips an org until its Alertmanager has
// been created) and unified-storage read-after-write lag.
func seedSingleton(t *testing.T, ctx context.Context, helper *apis.K8sTestHelper) {
	t.Helper()
	moa := helper.GetEnv().Server.HTTPServer.AlertNG.MultiOrgAlertmanager
	require.NotNil(t, moa, "MultiOrgAlertmanager must be wired in the test env")
	adminClient := newConfigClient(t, helper.Org1.Admin)
	require.Eventually(t, func() bool {
		if err := moa.LoadAndSyncAlertmanagersForOrgs(ctx); err != nil {
			return false
		}
		_, err := adminClient.Get(ctx, singletonID)
		return err == nil
	}, 30*time.Second, 500*time.Millisecond, "sync worker did not seed the Config singleton")
}

func requireForbidden(t *testing.T, err error, msgContains string) {
	t.Helper()
	require.Error(t, err)
	require.Truef(t, errors.IsForbidden(err), "expected Forbidden (403) but got: %s", err)
	if msgContains != "" {
		require.Contains(t, err.Error(), msgContains)
	}
}

// configWildcardPermission grants the given Config actions over the all-uid
// scope (configs:uid:*), which covers the configs:uid:default scope the
// authorizer evaluates against.
func configWildcardPermission(actions ...string) resourcepermissions.SetResourcePermissionCommand {
	return resourcepermissions.SetResourcePermissionCommand{
		Actions:           actions,
		Resource:          accesscontrol.AlertingConfigResource,
		ResourceAttribute: "uid",
		ResourceID:        "*",
	}
}

// TestIntegrationConfigAccessControl pins down the custom authorizer behavior:
//   - get/list gated by configs:get (read), granted to Viewer and Admin.
//   - patch/update gated by configs:update, granted to Admin only.
//   - create is service-identity only: forbidden for every human (the singleton is
//     seeded by the sync worker).
//   - delete/deletecollection is rejected for everyone ("cannot be deleted").
//   - /status writes require the service-identity-only configs/status:update and
//     are forbidden for every human, including Admin.
func TestIntegrationConfigAccessControl(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := getTestHelper(t)
	org1 := helper.Org1

	// Custom reader: only the Config read action.
	reader := helper.CreateUser("ConfigReader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		configWildcardPermission(accesscontrol.ActionAlertingConfigRead),
	})
	// Custom writer: read + update, no status action.
	writer := helper.CreateUser("ConfigWriter", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		configWildcardPermission(accesscontrol.ActionAlertingConfigRead, accesscontrol.ActionAlertingConfigUpdate),
	})

	type testCase struct {
		user      apis.User
		canRead   bool
		canUpdate bool
	}

	testCases := []testCase{
		{user: org1.Admin, canRead: true, canUpdate: true},
		{user: org1.Viewer, canRead: true, canUpdate: false},
		{user: org1.None, canRead: false, canUpdate: false},
		{user: reader, canRead: true, canUpdate: false},
		{user: writer, canRead: true, canUpdate: true},
	}

	// Singleton must exist so reads/updates target a real object.
	seedSingleton(t, ctx, helper)

	for _, tc := range testCases {
		t.Run(fmt.Sprintf("user '%s'", tc.user.Identity.GetLogin()), func(t *testing.T) {
			client := newConfigClient(t, tc.user)

			if tc.canRead {
				t.Run("can get the singleton", func(t *testing.T) {
					got, err := client.Get(ctx, singletonID)
					require.NoError(t, err)
					require.Equal(t, alertingnotifv0alpha1.ConfigSingletonName, got.Name)
				})
				t.Run("can list configs", func(t *testing.T) {
					list, err := client.List(ctx, apis.DefaultNamespace, resource.ListOptions{})
					require.NoError(t, err)
					require.Len(t, list.Items, 1)
				})
			} else {
				t.Run("is forbidden to get the singleton", func(t *testing.T) {
					_, err := client.Get(ctx, singletonID)
					requireForbidden(t, err, "")
				})
				t.Run("is forbidden to list configs", func(t *testing.T) {
					_, err := client.List(ctx, apis.DefaultNamespace, resource.ListOptions{})
					requireForbidden(t, err, "")
				})
			}

			if tc.canUpdate {
				t.Run("can update the singleton", func(t *testing.T) {
					_, err := client.Update(ctx, newConfig(alertingnotifv0alpha1.ConfigSingletonName), resource.UpdateOptions{})
					require.NoError(t, err)
				})
			} else {
				t.Run("is forbidden to update the singleton", func(t *testing.T) {
					_, err := client.Update(ctx, newConfig(alertingnotifv0alpha1.ConfigSingletonName), resource.UpdateOptions{})
					requireForbidden(t, err, "")
				})
			}

			// create is service-identity only: every human is forbidden regardless of
			// update permission. The singleton is brought into existence by the sync
			// worker; humans only read/update the seeded object.
			t.Run("is forbidden to create", func(t *testing.T) {
				_, err := client.Create(ctx, newConfig(alertingnotifv0alpha1.ConfigSingletonName), resource.CreateOptions{})
				requireForbidden(t, err, "seeded automatically")
			})

			t.Run("is forbidden to delete", func(t *testing.T) {
				err := client.Delete(ctx, singletonID, resource.DeleteOptions{})
				requireForbidden(t, err, "cannot be deleted")
			})

			t.Run("is forbidden to write status", func(t *testing.T) {
				_, err := client.UpdateStatus(ctx, singletonID, alertingnotifv0alpha1.ConfigStatus{
					ObservedGeneration: ptr(int64(1)),
				}, resource.UpdateOptions{})
				requireForbidden(t, err, "")
			})
		})
	}
}

// TestIntegrationConfigCreate verifies that humans cannot bring the singleton into
// existence — it is seeded by the sync worker, and human create is denied on every
// path. A POST is rejected by the authorizer (verb=create); a PUT upsert to the
// missing object is re-authorized by the apiserver as create and rejected the same
// way. Each subtest uses a fresh server so the singleton does not yet exist.
func TestIntegrationConfigCreate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	ctx := context.Background()

	t.Run("POST create is forbidden for humans", func(t *testing.T) {
		helper := getTestHelper(t)
		_, err := newConfigClient(t, helper.Org1.Admin).Create(ctx, newConfig(alertingnotifv0alpha1.ConfigSingletonName), resource.CreateOptions{})
		requireForbidden(t, err, "seeded automatically")
	})

	t.Run("PUT upsert (create-on-update) is forbidden for humans", func(t *testing.T) {
		helper := getTestHelper(t)
		_, err := rawUpdate(t, ctx, helper.Org1.Admin, newConfig(alertingnotifv0alpha1.ConfigSingletonName))
		requireForbidden(t, err, "")
	})
}

// TestIntegrationConfigValidator verifies the datasource admission validator for
// spec.externalAlertmanagerSync.datasourceUid (active because the sync feature
// flag is enabled in getTestHelper):
//   - setting a non-existent UID is rejected ("datasource not found").
//   - clearing / leaving the UID unset is always allowed.
//
// TODO: the happy-path (a real, syncable Mimir/Cortex Alertmanager datasource)
// is out of scope here — provisioning such a datasource against the in-process
// server is non-trivial; the validator's accept path is covered by the unit test
// TestNewExternalSyncDatasourceValidator in the register package.
func TestIntegrationConfigValidator(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := getTestHelper(t)
	adminClient := newConfigClient(t, helper.Org1.Admin)

	// Seed the singleton with no sync configured.
	seedSingleton(t, ctx, helper)

	t.Run("setting a non-existent datasource UID is rejected", func(t *testing.T) {
		cfg := newConfig(alertingnotifv0alpha1.ConfigSingletonName)
		cfg.Spec.ExternalAlertmanagerSync = &alertingnotifv0alpha1.ConfigV0alpha1SpecExternalAlertmanagerSync{
			DatasourceUid: ptr("does-not-exist-uid"),
		}
		_, err := adminClient.Update(ctx, cfg, resource.UpdateOptions{})
		requireForbidden(t, err, "datasource not found")
	})

	t.Run("clearing the datasource UID is allowed", func(t *testing.T) {
		cfg := newConfig(alertingnotifv0alpha1.ConfigSingletonName)
		cfg.Spec.ExternalAlertmanagerSync = nil
		_, err := adminClient.Update(ctx, cfg, resource.UpdateOptions{})
		require.NoError(t, err)
	})
}

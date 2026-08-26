package config

import (
	"context"
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

	alertingrulesv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
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
	Name:      alertingrulesv0alpha1.ConfigSingletonName,
}

// configGVR is used by the raw dynamic client below.
var configGVR = schema.GroupVersionResource{
	Group:    alertingrulesv0alpha1.GroupVersion.Group,
	Version:  alertingrulesv0alpha1.GroupVersion.Version,
	Resource: "configs",
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// getTestHelper boots an in-process Grafana with the external-ruler sync
// feature flag enabled. The flag is required for the datasource admission
// validator to run (with it off the validator short-circuits with "sync is
// disabled on this instance"); see newExternalRulerSyncDatasourceValidator in
// pkg/registry/apps/alerting/rules/register.go. No poll-interval override is
// needed here: the syncer's own baselineCheckInterval (10s, fixed, not
// operator-configurable) already keeps seedSingleton's wait short.
// NGAlertAdminConfigPollInterval is a different, unrelated knob (AlertsRouter's
// own cadence) and has no effect on this syncer at all.
func getTestHelper(t *testing.T) *apis.K8sTestHelper {
	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{
			featuremgmt.FlagAlertingSyncExternalRuler,
		},
	})
}

func ptr[T any](v T) *T { return &v }

func newConfigClient(t *testing.T, user apis.User) *alertingrulesv0alpha1.ConfigClient {
	t.Helper()
	client, err := alertingrulesv0alpha1.NewConfigClientFromGenerator(user.GetClientRegistry())
	require.NoError(t, err)
	return client
}

// rawConfigClient returns a dynamic client for Config in the default
// namespace. Unlike the generated ConfigClient, the dynamic client's Update
// issues a direct PUT without first GETting the object, so it can exercise
// the server-side create-on-update (upsert) path for a not-yet-existing
// singleton.
func rawConfigClient(t *testing.T, user apis.User) dynamic.ResourceInterface {
	t.Helper()
	return user.ResourceClient(t, configGVR).Namespace(apis.DefaultNamespace)
}

// rawUpdate PUTs cfg via the dynamic client (create-on-update capable).
func rawUpdate(t *testing.T, ctx context.Context, user apis.User, cfg *alertingrulesv0alpha1.Config) (*alertingrulesv0alpha1.Config, error) {
	t.Helper()
	obj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(cfg)
	require.NoError(t, err)
	res, err := rawConfigClient(t, user).Update(ctx, &unstructured.Unstructured{Object: obj}, v1.UpdateOptions{})
	if err != nil {
		return nil, err
	}
	out := &alertingrulesv0alpha1.Config{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(res.Object, out))
	return out, nil
}

// ExternalRulerSync is left unset, which is always valid (clearing/omitting
// is never rejected by the admission validator).
func newConfig(name string) *alertingrulesv0alpha1.Config {
	return &alertingrulesv0alpha1.Config{
		TypeMeta: v1.TypeMeta{
			Kind:       alertingrulesv0alpha1.ConfigKind().Kind(),
			APIVersion: alertingrulesv0alpha1.GroupVersion.Identifier(),
		},
		ObjectMeta: v1.ObjectMeta{
			Namespace: apis.DefaultNamespace,
			Name:      name,
		},
		Spec: alertingrulesv0alpha1.ConfigSpec{},
	}
}

// seedSingleton brings the "default" singleton into existence the way
// production does — by waiting for the sync worker's own flag-on-but-
// unconfigured tick to seed it (create is service-identity only; humans only
// ever read/update the already-seeded object). getTestHelper shortens the
// poll interval so this stays fast; require.Eventually absorbs the remaining
// race with the first tick and unified-storage read-after-write lag.
func seedSingleton(t *testing.T, ctx context.Context, helper *apis.K8sTestHelper) {
	t.Helper()
	adminClient := newConfigClient(t, helper.Org1.Admin)
	require.Eventually(t, func() bool {
		_, err := adminClient.Get(ctx, singletonID)
		return err == nil
	}, 30*time.Second, 200*time.Millisecond, "sync worker did not seed the Config singleton")
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
// scope (rules-configs:uid:*), which covers the rules-configs:uid:default scope
// the authorizer evaluates against.
func configWildcardPermission(actions ...string) resourcepermissions.SetResourcePermissionCommand {
	return resourcepermissions.SetResourcePermissionCommand{
		Actions:           actions,
		Resource:          accesscontrol.AlertingRulesConfigScopeRoot,
		ResourceAttribute: "uid",
		ResourceID:        "*",
	}
}

// TestIntegrationConfigAccessControl pins down the custom authorizer behavior
// against a real apiserver:
//   - get/list gated by rules-configs:get (read), granted to Viewer and Admin.
//   - patch/update gated by rules-configs:update, granted to Admin only.
//   - create is service-identity only: forbidden for every human (the singleton
//     is seeded by the sync worker).
//   - delete/deletecollection is rejected for everyone ("cannot be deleted").
//   - /status writes require the service-identity-only rules-configs/status:update
//     and are forbidden for every human, including Admin.
func TestIntegrationConfigAccessControl(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := getTestHelper(t)
	org1 := helper.Org1

	// Custom reader: only the Config read action.
	reader := helper.CreateUser("ConfigReader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		configWildcardPermission(accesscontrol.ActionAlertingRulesConfigRead),
	})
	// Custom writer: read + update, no status action.
	writer := helper.CreateUser("ConfigWriter", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		configWildcardPermission(accesscontrol.ActionAlertingRulesConfigRead, accesscontrol.ActionAlertingRulesConfigUpdate),
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
		t.Run("user '"+tc.user.Identity.GetLogin()+"'", func(t *testing.T) {
			client := newConfigClient(t, tc.user)

			if tc.canRead {
				t.Run("can get the singleton", func(t *testing.T) {
					got, err := client.Get(ctx, singletonID)
					require.NoError(t, err)
					require.Equal(t, alertingrulesv0alpha1.ConfigSingletonName, got.Name)
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
					_, err := client.Update(ctx, newConfig(alertingrulesv0alpha1.ConfigSingletonName), resource.UpdateOptions{})
					require.NoError(t, err)
				})
			} else {
				t.Run("is forbidden to update the singleton", func(t *testing.T) {
					_, err := client.Update(ctx, newConfig(alertingrulesv0alpha1.ConfigSingletonName), resource.UpdateOptions{})
					requireForbidden(t, err, "")
				})
			}

			// create is service-identity only: every human is forbidden regardless of
			// update permission. The singleton is brought into existence by the sync
			// worker; humans only read/update the seeded object.
			t.Run("is forbidden to create", func(t *testing.T) {
				_, err := client.Create(ctx, newConfig(alertingrulesv0alpha1.ConfigSingletonName), resource.CreateOptions{})
				requireForbidden(t, err, "seeded automatically")
			})

			t.Run("is forbidden to delete", func(t *testing.T) {
				err := client.Delete(ctx, singletonID, resource.DeleteOptions{})
				requireForbidden(t, err, "cannot be deleted")
			})

			t.Run("is forbidden to write status", func(t *testing.T) {
				_, err := client.UpdateStatus(ctx, singletonID, alertingrulesv0alpha1.ConfigStatus{
					ObservedGeneration: ptr(int64(1)),
				}, resource.UpdateOptions{})
				requireForbidden(t, err, "")
			})
		})
	}
}

// TestIntegrationConfigCreate verifies that humans cannot bring the singleton
// into existence — it is seeded by the sync worker, and human create is denied
// on every path. A POST is rejected by the authorizer (verb=create); a PUT
// upsert to the missing object is re-authorized by the apiserver as create and
// rejected the same way. Each subtest uses a fresh server so the singleton
// does not yet exist.
func TestIntegrationConfigCreate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	ctx := context.Background()

	t.Run("POST create is forbidden for humans", func(t *testing.T) {
		helper := getTestHelper(t)
		_, err := newConfigClient(t, helper.Org1.Admin).Create(ctx, newConfig(alertingrulesv0alpha1.ConfigSingletonName), resource.CreateOptions{})
		requireForbidden(t, err, "seeded automatically")
	})

	t.Run("PUT upsert (create-on-update) is forbidden for humans", func(t *testing.T) {
		helper := getTestHelper(t)
		_, err := rawUpdate(t, ctx, helper.Org1.Admin, newConfig(alertingrulesv0alpha1.ConfigSingletonName))
		requireForbidden(t, err, "")
	})
}

// TestIntegrationConfigValidator verifies the datasource admission validator
// for spec.externalRulerSync.datasourceUid (active because the sync feature
// flag is enabled in getTestHelper):
//   - setting a non-existent UID is rejected ("datasource not found").
//   - clearing / leaving the UID unset is always allowed.
//
// The happy-path (a real, syncable Mimir/Cortex ruler datasource) is out of
// scope here — provisioning such a datasource against the in-process server is
// non-trivial; the validator's accept path is covered by unit tests in the
// register package.
func TestIntegrationConfigValidator(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := getTestHelper(t)
	adminClient := newConfigClient(t, helper.Org1.Admin)

	// Seed the singleton with no sync configured.
	seedSingleton(t, ctx, helper)

	t.Run("setting a non-existent datasource UID is rejected", func(t *testing.T) {
		cfg := newConfig(alertingrulesv0alpha1.ConfigSingletonName)
		cfg.Spec.ExternalRulerSync = &alertingrulesv0alpha1.ConfigV0alpha1SpecExternalRulerSync{
			DatasourceUid: ptr("does-not-exist-uid"),
		}
		_, err := adminClient.Update(ctx, cfg, resource.UpdateOptions{})
		requireForbidden(t, err, "datasource not found")
	})

	t.Run("clearing the datasource UID is allowed", func(t *testing.T) {
		cfg := newConfig(alertingrulesv0alpha1.ConfigSingletonName)
		cfg.Spec.ExternalRulerSync = nil
		_, err := adminClient.Update(ctx, cfg, resource.UpdateOptions{})
		require.NoError(t, err)
	})
}

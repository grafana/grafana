package userstorage

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	userstorage "github.com/grafana/grafana/apps/userstorage/pkg/apis/userstorage/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// outcome reduces a response to what a caller can tell apart.
func outcome(err error) string {
	if err == nil {
		return "ok"
	}
	var status apierrors.APIStatus
	if errors.As(err, &status) {
		return fmt.Sprintf("%d %s", status.Status().Code, status.Status().Reason)
	}
	return err.Error()
}

func newUserStorage(name string, data map[string]any) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": userstorage.APIGroup + "/" + userstorage.APIVersion,
		"kind":       "UserStorage",
		"metadata":   map[string]any{"name": name},
		"spec":       map[string]any{"data": data},
	}}
}

// runScenario exercises user storage as an owner and as another user, and
// returns what each step did, so the legacy and routed servers can be compared.
func runScenario(t *testing.T, routed bool) []string {
	var flags []string
	if routed {
		flags = append(flags,
			featuremgmt.FlagGrafanaUseRouterMiddleware,
			featuremgmt.FlagRouterRegisterCoreAPIs,
			featuremgmt.FlagApppluginsLoadAppManifest,
		)
	}
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    false, // required for experimental APIs
		DisableAnonymous:     true,
		LocalPluginAPI:       routed,
		EnableFeatureToggles: flags,
	})

	if routed {
		waitForCoreApp(t, helper, userstorage.APIGroup)
	}

	gvr := userstorage.UserStorageResourceInfo.GroupVersionResource()
	owner := helper.Org1.Editor
	other := helper.Org1.Viewer
	ownerClient := helper.GetResourceClient(apis.ResourceClientArgs{User: owner, GVR: gvr}).Resource
	otherClient := helper.GetResourceClient(apis.ResourceClientArgs{User: other, GVR: gvr}).Resource
	// The Grafana server admin may reach every user's storage.
	adminClient := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: gvr}).Resource

	uid := func(u apis.User) string {
		_, id, ok := strings.Cut(u.Identity.GetUID(), ":")
		require.True(t, ok, "unexpected identity uid %q", u.Identity.GetUID())
		return id
	}
	ownName := "my-service:" + uid(owner)
	otherName := "my-service:" + uid(other)

	ctx := context.Background()
	var steps []string
	record := func(step string, err error) {
		t.Helper()
		steps = append(steps, step+": "+outcome(err))
	}

	_, err := ownerClient.Create(ctx, newUserStorage(ownName, map[string]any{"a": "1"}), metav1.CreateOptions{})
	record("owner creates own", err)
	require.NoError(t, err)

	_, err = ownerClient.Create(ctx, newUserStorage(otherName, map[string]any{"a": "1"}), metav1.CreateOptions{})
	record("owner creates for another user", err)
	require.Error(t, err)

	_, err = ownerClient.Create(ctx, newUserStorage("no-user-in-name", map[string]any{"a": "1"}), metav1.CreateOptions{})
	record("owner creates a malformed name", err)
	require.Error(t, err)

	got, err := ownerClient.Get(ctx, ownName, metav1.GetOptions{})
	record("owner gets own", err)
	require.NoError(t, err)
	data, _, _ := unstructured.NestedStringMap(got.Object, "spec", "data")
	require.Equal(t, map[string]string{"a": "1"}, data)

	_, err = otherClient.Get(ctx, ownName, metav1.GetOptions{})
	record("other gets owner's", err)
	require.Error(t, err)

	got.Object["spec"] = map[string]any{"data": map[string]any{"a": "2", "b": "3"}}
	updated, err := ownerClient.Update(ctx, got, metav1.UpdateOptions{})
	record("owner updates own", err)
	require.NoError(t, err)
	data, _, _ = unstructured.NestedStringMap(updated.Object, "spec", "data")
	require.Equal(t, map[string]string{"a": "2", "b": "3"}, data)

	_, err = otherClient.Update(ctx, updated, metav1.UpdateOptions{})
	record("other updates owner's", err)
	require.Error(t, err)

	_, err = ownerClient.List(ctx, metav1.ListOptions{})
	record("owner lists", err)
	require.Error(t, err)

	_, err = adminClient.Get(ctx, ownName, metav1.GetOptions{})
	record("server admin gets owner's", err)
	require.NoError(t, err)

	list, err := adminClient.List(ctx, metav1.ListOptions{})
	record("server admin lists", err)
	require.NoError(t, err)
	require.Len(t, list.Items, 1)

	err = otherClient.Delete(ctx, ownName, metav1.DeleteOptions{})
	record("other deletes owner's", err)
	require.Error(t, err)

	err = ownerClient.Delete(ctx, ownName, metav1.DeleteOptions{})
	record("owner deletes own", err)
	require.NoError(t, err)

	_, err = ownerClient.Get(ctx, ownName, metav1.GetOptions{})
	record("owner gets deleted", err)
	require.Error(t, err)

	return steps
}

// waitForCoreApp waits until the router serves group from a core app. Until
// its first reconcile completes, the router leaves every request to the
// embedded API server, which would make a routed run test the legacy builder.
func waitForCoreApp(t *testing.T, helper *apis.K8sTestHelper, group string) {
	t.Helper()
	client := helper.Org1.Admin.RESTClient(t, &userstorage.GroupVersion)
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		raw, err := client.Get().AbsPath("apis", "discovery", "v1alpha2", "status").DoRaw(context.Background())
		if !assert.NoError(c, err) {
			return
		}
		var status struct {
			Ready  bool `json:"ready"`
			Groups []struct {
				Group  string `json:"group"`
				Source string `json:"source"`
			} `json:"groups"`
		}
		if !assert.NoError(c, json.Unmarshal(raw, &status)) {
			return
		}
		assert.True(c, status.Ready, "router is not ready")
		served := false
		for _, g := range status.Groups {
			served = served || (g.Group == group && g.Source == "core")
		}
		assert.True(c, served, "router does not serve %s from a core app", group)
	}, 30*time.Second, 100*time.Millisecond)
}

func TestIntegrationUserStorage(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	var legacy, routed []string
	t.Run("legacy", func(t *testing.T) { legacy = runScenario(t, false) })
	t.Run("routed", func(t *testing.T) { routed = runScenario(t, true) })

	// The router must answer as the embedded API server does.
	require.Equal(t, legacy, routed)
}

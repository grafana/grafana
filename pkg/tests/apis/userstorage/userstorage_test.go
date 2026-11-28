package userstorage

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

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
		helper.WaitForCoreApp(userstorage.APIGroup)
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

	// The objects are private to their user, so no generic read route serves
	// them: the kind opts out of search and trash, and users may not list keys.
	for _, u := range []struct {
		who  string
		user apis.User
	}{{"owner", owner}, {"server admin", helper.Org1.Admin}} {
		rest := u.user.RESTClient(t, &userstorage.GroupVersion)
		for _, route := range []string{"search", "trash", "list-keys"} {
			var code int
			rest.Post().
				AbsPath("apis", gvr.Group, gvr.Version, "namespaces", "default", gvr.Resource, route).
				Body([]byte("{}")).SetHeader("Content-Type", "application/json").
				Do(ctx).StatusCode(&code)
			steps = append(steps, fmt.Sprintf("%s posts %s: %d", u.who, route, code))
			require.NotEqual(t, http.StatusOK, code, "%s %s", u.who, route)
		}
	}

	_, err = ownerClient.Create(ctx, newUserStorage(otherName, map[string]any{"a": "1"}), metav1.CreateOptions{})
	record("owner creates for another user", err)
	require.Error(t, err)

	_, err = ownerClient.Create(ctx, newUserStorage("no-user-in-name", map[string]any{"a": "1"}), metav1.CreateOptions{})
	record("owner creates a malformed name", err)
	require.Error(t, err)

	// A generated name could not be checked against the caller.
	generated := newUserStorage("", map[string]any{"a": "1"})
	generated.SetGenerateName("my-service:")
	_, err = ownerClient.Create(ctx, generated, metav1.CreateOptions{})
	record("owner creates with a generated name", err)
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

	// The frontend client (grafana-runtime userStorage) writes with merge
	// patches, deletes a key by patching it to null, and retries on a conflict.
	patched, err := ownerClient.Patch(ctx, ownName, types.MergePatchType,
		[]byte(`{"spec":{"data":{"b":null,"c":"4"}}}`), metav1.PatchOptions{})
	record("owner merge-patches own", err)
	require.NoError(t, err)
	data, _, _ = unstructured.NestedStringMap(patched.Object, "spec", "data")
	require.Equal(t, map[string]string{"a": "2", "c": "4"}, data)

	stale := fmt.Sprintf(`{"metadata":{"resourceVersion":%q},"spec":{"data":{"a":"stale"}}}`, updated.GetResourceVersion())
	_, err = ownerClient.Patch(ctx, ownName, types.MergePatchType, []byte(stale), metav1.PatchOptions{})
	record("owner patches with a stale version", err)
	require.True(t, apierrors.IsConflict(err), "got %v", err)

	_, err = ownerClient.Create(ctx, newUserStorage(ownName, map[string]any{"a": "1"}), metav1.CreateOptions{})
	record("owner creates own again", err)
	require.True(t, apierrors.IsAlreadyExists(err), "got %v", err)

	_, err = otherClient.Patch(ctx, ownName, types.MergePatchType, []byte(`{"spec":{"data":{"a":"x"}}}`), metav1.PatchOptions{})
	record("other patches owner's", err)
	require.Error(t, err)

	missingName := "other-service:" + uid(owner)
	_, err = ownerClient.Patch(ctx, missingName, types.MergePatchType, []byte(`{"spec":{"data":{"a":"x"}}}`), metav1.PatchOptions{})
	record("owner patches a missing object", err)
	require.True(t, apierrors.IsNotFound(err), "a patch must not create the object: %v", err)

	_, err = ownerClient.List(ctx, metav1.ListOptions{})
	record("owner lists", err)
	require.Error(t, err)

	_, err = ownerClient.List(ctx, metav1.ListOptions{FieldSelector: "metadata.name=" + ownName})
	record("owner lists their own name", err)
	require.Error(t, err)

	err = ownerClient.DeleteCollection(ctx, metav1.DeleteOptions{}, metav1.ListOptions{})
	record("owner deletes the collection", err)
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

func TestIntegrationUserStorage(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	var legacy, routed []string
	t.Run("legacy", func(t *testing.T) { legacy = runScenario(t, false) })
	t.Run("routed", func(t *testing.T) { routed = runScenario(t, true) })

	// The router must answer as the embedded API server does.
	require.Equal(t, legacy, routed)
}

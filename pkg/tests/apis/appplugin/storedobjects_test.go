package appplugin

import (
	"context"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	grafanafs "github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const (
	storedObjectsPluginID = "test-app-with-pluginschema"
	storedObjectsGroup    = "test-app-with-pluginschema"
	storedObjectsVersion  = "v0alpha1"
)

// TestIntegrationPluginSchemaDiscovery verifies that an app plugin shipping a
// pluginschema.PluginSchema artifact with a stored object is picked up and
// the declared kind appears in the apiserver discovery doc alongside the
// existing app plugin settings resource.
//
// The fixture's stored object declares no admission opt-in (Validation and
// Mutation are empty), so admission is never invoked and CRUD round-trips
// through unified storage without needing a backend process.
func TestIntegrationPluginSchemaDiscovery(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupStoredObjectsHelper(t)

	disco, err := helper.GetGroupVersionInfoJSON(storedObjectsGroup)
	require.NoError(t, err)
	require.Contains(t, disco, `"resource": "watchlists"`)
	require.Contains(t, disco, `"kind": "Watchlist"`)

	// The whole point of the absorption: our watchlists resource must appear
	// in the SAME discovery doc as the existing app plugin's settings
	// resource (named "app" at the URL surface). If they ended up in
	// different groups, the builder didn't combine them.
	require.Contains(t, disco, `"resource": "app"`)
}

// TestIntegrationPluginSchemaCreate exercises the storage round-trip: Create,
// Get, List, Apply. The fixture declines admission opt-in so the create
// succeeds without a plugin backend.
func TestIntegrationPluginSchemaCreate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupStoredObjectsHelper(t)

	gvr := schema.GroupVersionResource{
		Group:    storedObjectsGroup,
		Version:  storedObjectsVersion,
		Resource: "watchlists",
	}
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default",
		GVR:       gvr,
	})

	apiVersion := storedObjectsGroup + "/" + storedObjectsVersion

	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": apiVersion,
		"kind":       "Watchlist",
		"metadata": map[string]any{
			"name":      "watchlist-1",
			"namespace": "default",
		},
		"spec": map[string]any{
			"title":    "outages",
			"patterns": []any{"5xx"},
			"severity": "warn",
		},
	}}

	created, err := client.Resource.Create(context.Background(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = client.Resource.Delete(context.Background(), created.GetName(), metav1.DeleteOptions{})
	})

	require.Equal(t, apiVersion, created.GetAPIVersion())
	require.Equal(t, "Watchlist", created.GetKind())

	got, err := client.Resource.Get(context.Background(), "watchlist-1", metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, apiVersion, got.GetAPIVersion())

	list, err := client.Resource.List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, list.Items, 1)
	require.Equal(t, "watchlist-1", list.Items[0].GetName())

	applyObj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": apiVersion,
		"kind":       "Watchlist",
		"metadata": map[string]any{
			"name":      "watchlist-1",
			"namespace": "default",
		},
		"spec": map[string]any{
			"title":    "outages",
			"patterns": []any{"5xx", "504"},
			"severity": "crit",
		},
	}}
	applied, err := client.Resource.Apply(context.Background(), "watchlist-1", applyObj, metav1.ApplyOptions{
		Force:        true,
		FieldManager: "storedobjects-test",
	})
	require.NoError(t, err)
	require.Equal(t, apiVersion, applied.GetAPIVersion())
}

// TestIntegrationPluginSchemaStatus exercises the /status subresource that is
// registered because the fixture's Watchlist declares a status schema.
func TestIntegrationPluginSchemaStatus(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupStoredObjectsHelper(t)

	gvr := schema.GroupVersionResource{
		Group:    storedObjectsGroup,
		Version:  storedObjectsVersion,
		Resource: "watchlists",
	}
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default",
		GVR:       gvr,
	})

	apiVersion := storedObjectsGroup + "/" + storedObjectsVersion
	ctx := context.Background()

	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": apiVersion,
		"kind":       "Watchlist",
		"metadata": map[string]any{
			"name":      "watchlist-status",
			"namespace": "default",
		},
		"spec": map[string]any{
			"title":    "outages",
			"patterns": []any{"5xx"},
			"severity": "warn",
		},
	}}

	created, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = client.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
	})

	// Write status through the /status subresource, as a plugin reconciler
	// would.
	withStatus := created.DeepCopy()
	withStatus.Object["status"] = map[string]any{
		"state":   "synced",
		"message": "all patterns active",
	}
	updated, err := client.Resource.UpdateStatus(ctx, withStatus, metav1.UpdateOptions{})
	require.NoError(t, err)

	state, found, err := unstructured.NestedString(updated.Object, "status", "state")
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "synced", state)

	// The status write persists.
	got, err := client.Resource.Get(ctx, "watchlist-status", metav1.GetOptions{})
	require.NoError(t, err)
	msg, found, err := unstructured.NestedString(got.Object, "status", "message")
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "all patterns active", msg)

	// A status update does not change spec: the status write above carried
	// the original spec, and it is intact afterwards.
	title, _, err := unstructured.NestedString(got.Object, "spec", "title")
	require.NoError(t, err)
	require.Equal(t, "outages", title)

	// A status update that also tampers with spec: the generic status
	// strategy (genericStatusStrategy.PrepareForUpdate) only restores
	// metadata from the old object, not spec, so a spec change smuggled
	// through /status is persisted. Assert the actual behavior so a future
	// fix to the strategy shows up as a test failure here.
	tampered := got.DeepCopy()
	require.NoError(t, unstructured.SetNestedField(tampered.Object, "tampered-via-status", "spec", "title"))
	afterTamper, err := client.Resource.UpdateStatus(ctx, tampered, metav1.UpdateOptions{})
	require.NoError(t, err)
	title, _, err = unstructured.NestedString(afterTamper.Object, "spec", "title")
	require.NoError(t, err)
	require.Equal(t, "tampered-via-status", title,
		"expected the known gap: /status updates are not supposed to change spec, but the generic status strategy does not restore the old spec")

	// A plain spec update from a client that does not send a status field.
	// The generic strategy's PrepareForUpdate tries to carry status forward
	// via MetaAccessor GetStatus/SetStatus, but those only work for objects
	// with a Status Go field or *unstructured.Unstructured. Stored objects
	// decode into an UntypedObject wrapper that keeps status in a generic
	// Subresources map, so both calls silently fail and the previously
	// written status is clobbered by the spec write. Assert the actual
	// (lossy) behavior rather than papering over it; when the machinery
	// learns to preserve status for untyped objects this assertion should
	// flip.
	specUpdate, err := client.Resource.Get(ctx, "watchlist-status", metav1.GetOptions{})
	require.NoError(t, err)
	require.NoError(t, unstructured.SetNestedField(specUpdate.Object, "crit", "spec", "severity"))
	delete(specUpdate.Object, "status")
	afterSpec, err := client.Resource.Update(ctx, specUpdate, metav1.UpdateOptions{})
	require.NoError(t, err)
	severity, _, err := unstructured.NestedString(afterSpec.Object, "spec", "severity")
	require.NoError(t, err)
	require.Equal(t, "crit", severity)
	_, statusSurvived, err := unstructured.NestedMap(afterSpec.Object, "status")
	require.NoError(t, err)
	require.False(t, statusSurvived,
		"expected the known gap: spec updates clobber status for untyped stored objects because GetStatus/SetStatus cannot see the Subresources map")
}

func setupStoredObjectsHelper(t *testing.T) *apis.K8sTestHelper {
	t.Helper()

	dir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		EnableFeatureToggles: []string{
			// Enable the per-app-plugin api-server. Stored-object support
			// rides on top of it: when a plugin's schema artifact declares
			// stored objects, the existing AppPluginAPIBuilder registers
			// the kinds alongside the settings resource under the same
			// (group, version).
			featuremgmt.FlagApppluginsRegisterAPIServer,
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
		},
	})

	_, thisFile, _, ok := runtime.Caller(0)
	require.True(t, ok)
	testPluginSrc := filepath.Join(filepath.Dir(thisFile), "testdata", storedObjectsPluginID)
	testPluginDst := filepath.Join(dir, "plugins", storedObjectsPluginID)

	require.NoError(t, grafanafs.CopyRecursive(testPluginSrc, testPluginDst))

	helper := apis.NewK8sTestHelperWithOpts(t, apis.K8sTestHelperOpts{
		GrafanaOpts: testinfra.GrafanaOpts{
			Dir:     dir,
			DirPath: cfgPath,
		},
	})
	t.Cleanup(func() { helper.Shutdown() })
	return helper
}

package appplugin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"
	k8srest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Manifest APIs use the plugin ID as their group.
const thingAPIVersion = testAppID + "/v1"

// The manifest declares only v1, but a plugin's settings API must keep working
// after a manifest ships, so v0alpha1 is served alongside the manifest versions.
func TestIntegrationPluginManifestDiscovery(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupHelperWithManifest(t, rest.Mode5)

	disco, err := helper.GetGroupVersionInfoJSON(testAppID)
	require.NoError(t, err)
	require.JSONEq(t, `[
		{
			"version": "v1",
			"freshness": "Current",
			"resources": [
				{
					"resource": "app",
					"responseKind": {
						"group": "",
						"kind": "Settings",
						"version": ""
					},
					"scope": "Namespaced",
					"singularResource": "app",
					"subresources": [
						{
							"responseKind": {
								"group": "",
								"kind": "HealthCheckResult",
								"version": ""
							},
							"subresource": "health",
							"verbs": [
								"get"
							]
						},
						{
							"responseKind": {
								"group": "",
								"kind": "Status",
								"version": ""
							},
							"subresource": "resources",
							"verbs": [
								"create",
								"delete",
								"get",
								"patch",
								"update"
							]
						}
					],
					"verbs": [
						"create",
						"delete",
						"deletecollection",
						"get",
						"list",
						"patch",
						"update",
						"watch"
					]
				},
				{
					"resource": "things",
					"responseKind": {
						"group": "",
						"kind": "Thing",
						"version": ""
					},
					"scope": "Namespaced",
					"singularResource": "thing",
					"subresources": [
						{
							"responseKind": {
								"group": "",
								"kind": "Thing",
								"version": ""
							},
							"subresource": "status",
							"verbs": [
								"get",
								"patch",
								"update"
							]
						}
					],
					"verbs": [
						"create",
						"delete",
						"deletecollection",
						"get",
						"list",
						"patch",
						"update",
						"watch"
					]
				},
				{
					"resource": "widgets",
					"responseKind": {
						"group": "",
						"kind": "Widget",
						"version": ""
					},
					"scope": "Namespaced",
					"singularResource": "widget",
					"subresources": [
						{
							"responseKind": {
								"group": "",
								"kind": "Widget",
								"version": ""
							},
							"subresource": "status",
							"verbs": [
								"get",
								"patch",
								"update"
							]
						}
					],
					"verbs": [
						"create",
						"delete",
						"deletecollection",
						"get",
						"list",
						"patch",
						"update",
						"watch"
					]
				}
			]
		},
		{
			"version": "v0alpha1",
			"freshness": "Current",
			"resources": [
				{
					"resource": "app",
					"responseKind": {
						"group": "",
						"kind": "Settings",
						"version": ""
					},
					"scope": "Namespaced",
					"singularResource": "app",
					"subresources": [
						{
							"responseKind": {
								"group": "",
								"kind": "HealthCheckResult",
								"version": ""
							},
							"subresource": "health",
							"verbs": [
								"get"
							]
						},
						{
							"responseKind": {
								"group": "",
								"kind": "Status",
								"version": ""
							},
							"subresource": "resources",
							"verbs": [
								"create",
								"delete",
								"get",
								"patch",
								"update"
							]
						}
					],
					"verbs": [
						"create",
						"delete",
						"deletecollection",
						"get",
						"list",
						"patch",
						"update",
						"watch"
					]
				}
			]
		}
	]`, disco)
}

// TestIntegrationPluginManifestOpenAPIV2 verifies the aggregate spec resolves manifest schemas.
func TestIntegrationPluginManifestOpenAPIV2(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupHelperWithManifest(t, rest.Mode5)

	disco := helper.NewDiscoveryClient()
	result := disco.RESTClient().Get().AbsPath("/openapi/v2").Do(context.Background())
	require.NoError(t, result.Error())

	var statusCode int
	result.StatusCode(&statusCode)
	require.Equal(t, 200, statusCode)

	raw, err := result.Raw()
	require.NoError(t, err)
	require.Contains(t, string(raw), testAppID)
}

// newThing is the body of a valid Thing, ready to be given a name.
func newThing(name string, spec map[string]any) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": thingAPIVersion,
		"kind":       "Thing",
		"metadata": map[string]any{
			"name":      name,
			"namespace": "default",
		},
		"spec": spec,
	}}
}

// thingsClient returns a client for the manifest kind in the default namespace.
func thingsClient(t *testing.T, helper *apis.K8sTestHelper) dynamic.ResourceInterface {
	t.Helper()
	return helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default",
		GVR: schema.GroupVersionResource{
			Group:    testAppID,
			Version:  "v1",
			Resource: "things",
		},
	}).Resource
}

// TestIntegrationPluginManifestKindCRUD covers the full request lifecycle of a
// manifest kind: it is stored, read back, updated through every write verb the
// discovery document advertises, and deleted.
func TestIntegrationPluginManifestKindCRUD(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupHelperWithManifest(t, rest.Mode5)
	client := thingsClient(t, helper)
	ctx := context.Background()

	created, err := client.Create(ctx, newThing("thing-1", map[string]any{"foo": "bar"}), metav1.CreateOptions{})
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = client.Delete(ctx, "thing-1", metav1.DeleteOptions{})
	})

	t.Run("create returns a fully identified object", func(t *testing.T) {
		require.Equal(t, thingAPIVersion, created.GetAPIVersion())
		require.Equal(t, "Thing", created.GetKind())
		require.Equal(t, "thing-1", created.GetName())
		require.Equal(t, "default", created.GetNamespace())
		require.NotEmpty(t, created.GetUID())
		require.NotEmpty(t, created.GetResourceVersion())
		require.EqualValues(t, 1, created.GetGeneration())
		require.Equal(t, map[string]any{"foo": "bar"}, created.Object["spec"])
	})

	t.Run("create tracks managed fields", func(t *testing.T) {
		// The generic create handler cannot diff an unstructured kind against the
		// kindless empty object the scheme hands it, so it drops managedFields; the
		// kind store redoes that diff. Without this a later apply has nothing to
		// merge against and every field looks unowned.
		fields := created.GetManagedFields()
		require.Len(t, fields, 1, "the create is tracked as one entry")
		require.Equal(t, thingAPIVersion, fields[0].APIVersion)
		require.Equal(t, metav1.ManagedFieldsOperationUpdate, fields[0].Operation)
		require.Contains(t, fields[0].FieldsV1.GetRawString(), "f:spec")
	})

	t.Run("create rejects a body the manifest schema does not allow", func(t *testing.T) {
		for name, spec := range map[string]map[string]any{
			"missing a required field": {"count": 1},
			"wrong type":               {"foo": 42},
			"unknown field":            {"foo": "bar", "nope": true},
		} {
			t.Run(name, func(t *testing.T) {
				_, err := client.Create(ctx, newThing("thing-invalid", spec), metav1.CreateOptions{})
				require.Truef(t, apierrors.IsInvalid(err), "got %v", err)
			})
		}
	})

	t.Run("get reads the object back", func(t *testing.T) {
		got, err := client.Get(ctx, "thing-1", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, thingAPIVersion, got.GetAPIVersion())
		require.Equal(t, "Thing", got.GetKind())
		require.Equal(t, created.GetUID(), got.GetUID())
		require.Equal(t, map[string]any{"foo": "bar"}, got.Object["spec"])
	})

	t.Run("get of an unknown name is a 404", func(t *testing.T) {
		_, err := client.Get(ctx, "does-not-exist", metav1.GetOptions{})
		require.Truef(t, apierrors.IsNotFound(err), "got %v", err)
	})

	t.Run("list returns the kind's objects", func(t *testing.T) {
		// LIST exercises unified storage's unstructured list handling.
		list, err := client.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, "thing-1", list.Items[0].GetName())
		require.Equal(t, thingAPIVersion, list.Items[0].GetAPIVersion())
		require.Equal(t, "ThingList", list.GetKind())
	})

	t.Run("update replaces the spec", func(t *testing.T) {
		current, err := client.Get(ctx, "thing-1", metav1.GetOptions{})
		require.NoError(t, err)

		next := current.DeepCopy()
		next.Object["spec"] = map[string]any{"foo": "updated", "count": int64(2)}
		updated, err := client.Update(ctx, next, metav1.UpdateOptions{})
		require.NoError(t, err)

		require.Equal(t, map[string]any{"foo": "updated", "count": int64(2)}, updated.Object["spec"])
		require.NotEqual(t, current.GetResourceVersion(), updated.GetResourceVersion())
		require.Equal(t, created.GetUID(), updated.GetUID(), "the update must not replace the object")
		require.Greater(t, updated.GetGeneration(), current.GetGeneration(),
			"a spec change advances the generation controllers watch")

		// An update that changes nothing leaves the generation where it was.
		unchanged, err := client.Update(ctx, updated.DeepCopy(), metav1.UpdateOptions{})
		require.NoError(t, err)
		require.Equal(t, updated.GetGeneration(), unchanged.GetGeneration())
	})

	t.Run("update with a stale resourceVersion conflicts", func(t *testing.T) {
		stale := created.DeepCopy()
		stale.Object["spec"] = map[string]any{"foo": "stale"}
		_, err := client.Update(ctx, stale, metav1.UpdateOptions{})
		require.Truef(t, apierrors.IsConflict(err), "got %v", err)
	})

	t.Run("update rejects a body the manifest schema does not allow", func(t *testing.T) {
		current, err := client.Get(ctx, "thing-1", metav1.GetOptions{})
		require.NoError(t, err)
		next := current.DeepCopy()
		next.Object["spec"] = map[string]any{"count": 3}
		_, err = client.Update(ctx, next, metav1.UpdateOptions{})
		require.Truef(t, apierrors.IsInvalid(err), "got %v", err)
	})

	t.Run("merge patch updates one field", func(t *testing.T) {
		patched, err := client.Patch(ctx, "thing-1", types.MergePatchType,
			[]byte(`{"spec":{"foo":"patched"}}`), metav1.PatchOptions{})
		require.NoError(t, err)
		require.Equal(t, "patched", patched.Object["spec"].(map[string]any)["foo"])
		require.EqualValues(t, int64(2), patched.Object["spec"].(map[string]any)["count"],
			"a merge patch leaves the fields it does not name alone")
	})

	t.Run("json patch updates one field", func(t *testing.T) {
		patch, err := json.Marshal([]map[string]any{
			{"op": "replace", "path": "/spec/foo", "value": "json-patched"},
			{"op": "remove", "path": "/spec/count"},
		})
		require.NoError(t, err)
		patched, err := client.Patch(ctx, "thing-1", types.JSONPatchType, patch, metav1.PatchOptions{})
		require.NoError(t, err)
		require.Equal(t, map[string]any{"foo": "json-patched"}, patched.Object["spec"])
	})

	t.Run("apply merges by field manager", func(t *testing.T) {
		// Apply requires the manifest GVK in the OpenAPI definition.
		applied, err := client.Apply(ctx, "thing-1", newThing("thing-1", map[string]any{"foo": "applied"}),
			metav1.ApplyOptions{Force: true, FieldManager: "pluginmanifest-test"})
		require.NoError(t, err)
		require.Equal(t, thingAPIVersion, applied.GetAPIVersion())
		require.Equal(t, map[string]any{"foo": "applied"}, applied.Object["spec"])

		// The apply is recorded under its own manager, alongside the earlier entries.
		managers := map[string]metav1.ManagedFieldsOperationType{}
		for _, f := range applied.GetManagedFields() {
			managers[f.Manager] = f.Operation
		}
		require.Equal(t, metav1.ManagedFieldsOperationApply, managers["pluginmanifest-test"])
	})

	t.Run("status is only writable through its subresource", func(t *testing.T) {
		current, err := client.Get(ctx, "thing-1", metav1.GetOptions{})
		require.NoError(t, err)

		// The kind declares a status, so the main resource may not write it.
		withStatus := current.DeepCopy()
		withStatus.Object["status"] = map[string]any{"state": "ignored"}
		updated, err := client.Update(ctx, withStatus, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.NotContains(t, updated.Object, "status", "a write to the main resource cannot set status")

		// A write to the subresource may only change status: the spec it carries
		// is whatever the caller read, not an edit it is entitled to make.
		spec := updated.Object["spec"]
		generation := updated.GetGeneration()

		withStatus = updated.DeepCopy()
		withStatus.Object["status"] = map[string]any{"state": "running"}
		withStatus.Object["spec"] = map[string]any{"foo": "written-through-status"}
		updated, err = client.UpdateStatus(ctx, withStatus, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.Equal(t, map[string]any{"state": "running"}, updated.Object["status"])
		require.Equal(t, spec, updated.Object["spec"], "a status write cannot reach the spec")
		require.Equal(t, generation, updated.GetGeneration(), "and so cannot advance the generation")

		// And the status survives the next write to the main resource.
		next := updated.DeepCopy()
		next.Object["spec"] = map[string]any{"foo": "after-status"}
		delete(next.Object, "status")
		updated, err = client.Update(ctx, next, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.Equal(t, map[string]any{"state": "running"}, updated.Object["status"])
		require.Equal(t, map[string]any{"foo": "after-status"}, updated.Object["spec"])
	})

	t.Run("delete removes the object", func(t *testing.T) {
		require.NoError(t, client.Delete(ctx, "thing-1", metav1.DeleteOptions{}))

		_, err := client.Get(ctx, "thing-1", metav1.GetOptions{})
		require.Truef(t, apierrors.IsNotFound(err), "got %v", err)

		list, err := client.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Empty(t, list.Items)
	})

	t.Run("delete of an unknown name is a 404", func(t *testing.T) {
		err := client.Delete(ctx, "thing-1", metav1.DeleteOptions{})
		require.Truef(t, apierrors.IsNotFound(err), "got %v", err)
	})

	t.Run("delete collection empties the namespace", func(t *testing.T) {
		for _, name := range []string{"thing-a", "thing-b"} {
			_, err := client.Create(ctx, newThing(name, map[string]any{"foo": name}), metav1.CreateOptions{})
			require.NoError(t, err)
		}

		require.NoError(t, client.DeleteCollection(ctx, metav1.DeleteOptions{}, metav1.ListOptions{}))

		list, err := client.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Empty(t, list.Items)
	})
}

// TestIntegrationPluginManifestFolderScopedKind covers the kinds a manifest does
// not opt out of folders for, which is the default for a namespaced kind: they
// are stored under a folder, and unified storage will not accept one without.
func TestIntegrationPluginManifestFolderScopedKind(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupHelperWithManifest(t, rest.Mode5)
	ctx := context.Background()
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default",
		GVR: schema.GroupVersionResource{
			Group:    testAppID,
			Version:  "v1",
			Resource: "widgets",
		},
	}).Resource

	newWidget := func(name string) *unstructured.Unstructured {
		w := newThing(name, map[string]any{"foo": "bar"})
		w.SetKind("Widget")
		return w
	}

	t.Run("create without a folder is rejected", func(t *testing.T) {
		_, err := client.Create(ctx, newWidget("widget-nofolder"), metav1.CreateOptions{})
		require.Truef(t, apierrors.IsInvalid(err), "got %v", err)
		require.Contains(t, err.Error(), utils.AnnoKeyFolder)
	})

	t.Run("create in a folder that does not exist is rejected", func(t *testing.T) {
		w := newWidget("widget-badfolder")
		w.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "no-such-folder"})
		_, err := client.Create(ctx, w, metav1.CreateOptions{})
		require.Error(t, err)
		require.Contains(t, err.Error(), "no-such-folder")
	})

	t.Run("the manifest schema prunes and defaults the spec", func(t *testing.T) {
		const folderUID = "appplugin-widgets-schema"
		createFolder(t, ctx, helper, folderUID, "App plugin widget schema")

		w := newWidget("widget-schema")
		w.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})
		w.Object["spec"] = map[string]any{"foo": "bar", "notInTheSchema": "dropped"}

		created, err := client.Create(ctx, w, metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = client.Delete(ctx, "widget-schema", metav1.DeleteOptions{})
		})

		// What the same schema would have stored as a custom resource: the
		// undeclared field pruned, the declared default filled in.
		require.Equal(t, map[string]any{"foo": "bar", "tier": "standard"}, created.Object["spec"])
	})

	t.Run("create in a folder round trips", func(t *testing.T) {
		const folderUID = "appplugin-widgets"
		createFolder(t, ctx, helper, folderUID, "App plugin widgets")

		w := newWidget("widget-1")
		w.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})
		created, err := client.Create(ctx, w, metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = client.Delete(ctx, "widget-1", metav1.DeleteOptions{})
		})
		require.Equal(t, folderUID, created.GetAnnotations()[utils.AnnoKeyFolder])

		got, err := client.Get(ctx, "widget-1", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, folderUID, got.GetAnnotations()[utils.AnnoKeyFolder])
		require.Equal(t, "Widget", got.GetKind())
	})
}

// createFolder makes a folder through the legacy endpoint, which is what the
// folder-scoped storage resolves against.
func createFolder(t *testing.T, ctx context.Context, helper *apis.K8sTestHelper, uid, title string) {
	t.Helper()
	cfg := dynamic.ConfigFor(helper.Org1.Admin.NewRestConfig())
	cfg.GroupVersion = &schema.GroupVersion{Group: "folder.grafana.app", Version: "v1beta1"}
	restClient, err := k8srest.RESTClientFor(cfg)
	require.NoError(t, err)

	var code int
	res := restClient.Post().AbsPath("api", "folders").
		Body(fmt.Appendf(nil, `{"uid":%q,"title":%q}`, uid, title)).
		SetHeader("Content-type", "application/json").
		Do(ctx).
		StatusCode(&code)
	require.NoError(t, res.Error())
	require.Equal(t, http.StatusOK, code)
}

// TestIntegrationPluginManifestServiceLoading covers manifests loaded during service startup.
func TestIntegrationPluginManifestServiceLoading(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupHelperWithManifest(t, rest.Mode5, featuremgmt.FlagPluginStoreServiceLoading)

	disco, err := helper.GetGroupVersionInfoJSON(testAppID)
	require.NoError(t, err)
	require.Contains(t, disco, `"resource": "things"`)
}

// TestIntegrationPluginManifestKindRoutes covers routes a manifest declares on a
// kind. They mount as subresources of one object, resolve that object from
// storage, and dispatch to the plugin's v3 route service.
func TestIntegrationPluginManifestKindRoutes(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupHelperWithManifest(t, rest.Mode5)
	client := helper.NewDiscoveryClient().RESTClient()
	ctx := context.Background()

	raw, err := client.Get().AbsPath("/openapi/v3/apis/" + testAppID + "/v1").DoRaw(ctx)
	require.NoError(t, err)

	// Parsed rather than string-matched: a failed Contains on the whole spec is
	// unreadable.
	var doc struct {
		Paths map[string]json.RawMessage `json:"paths"`
	}
	require.NoError(t, json.Unmarshal(raw, &doc))

	prefix := "/apis/" + testAppID + "/v1/namespaces/{namespace}/things"
	require.Contains(t, doc.Paths, prefix+"/{name}/reload", "the kind route belongs in the OpenAPI spec")
	require.Contains(t, doc.Paths, prefix+"/{name}", "alongside the kind's own paths")

	// Search is mounted on the terms every other Grafana kind gets it on: Thing
	// declares search fields, so it is enrolled, and its endpoint names its own
	// path so it can never collide with a kind route, which is always mounted
	// under an object name.
	require.Contains(t, doc.Paths, prefix+"/search")
	// Trash grants access to whoever deleted the object; no plugin kind is on
	// the allowlist for it.
	require.NotContains(t, doc.Paths, prefix+"/trash")

	// Widget declares no search fields, so it is not enrolled -- declaring them
	// is what marks a kind as reviewed for search.
	require.NotContains(t, doc.Paths,
		"/apis/"+testAppID+"/v1/namespaces/{namespace}/widgets/search")

	route := "/apis/" + testAppID + "/v1/namespaces/default/things/thing-route/reload"

	// The route resolves its parent before dispatching, so an unknown object is
	// a 404 and the plugin is never called. A 405 or 404 on the path itself
	// would mean the route never got mounted.
	_, err = client.Get().AbsPath(route).DoRaw(ctx)
	require.True(t, apierrors.IsNotFound(err), "got %v", err)

	resourceClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default",
		GVR: schema.GroupVersionResource{
			Group:    testAppID,
			Version:  "v1",
			Resource: "things",
		},
	})
	created, err := resourceClient.Resource.Create(ctx, &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": thingAPIVersion,
		"kind":       "Thing",
		"metadata": map[string]any{
			"name":      "thing-route",
			"namespace": "default",
		},
		"spec": map[string]any{"foo": "bar"},
	}}, metav1.CreateOptions{})
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = resourceClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
	})

	// With the object in place the parent resolves and the request reaches the
	// plugin, which has no v3 backend.
	raw, err = client.Get().AbsPath(route).DoRaw(ctx)
	require.Error(t, err)

	// The lazy v3 client returns a ServiceUnavailable, but httpadapter.HandlerFunc
	// turns any CallRoute failure into a plain-text 500, so the status reason
	// and the k8s Status body are both lost on the way out.
	require.True(t, apierrors.IsInternalError(err), "got %v", err)
	require.Contains(t, string(raw), "does not implement ClientV3")
}

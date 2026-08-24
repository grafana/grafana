package appplugin

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// The served group is always the plugin id -- register.go overrides whatever
// group the manifest declares -- and the manifest's versions replace the
// default v0alpha1 settings-only group.
const thingAPIVersion = testAppID + "/v1"

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
				}
			]
		}
	]`, disco)
}

// TestIntegrationPluginManifestOpenAPIV2 verifies that the aggregate OpenAPI v2
// (swagger) spec builds successfully when a manifest kind declares a custom route.
// The root v2 spec is built lazily on first request and the apiserver crashes the
// process via klog.Fatalf if a referenced model definition cannot be resolved.
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
	// The manifest-defined kind must appear in the built spec.
	require.Contains(t, string(raw), testAppID)
}

// TestIntegrationPluginManifestCreate verifies a resource can be created and read back
// with its group intact. This guards against the shared-scheme group-mismatch bug, where
// the generic object type was registered under many groups and an unrelated group (e.g.
// quotas.grafana.app) could be stamped onto the created object, causing unified storage to
// reject the write with "group in key does not match group in the body".
func TestIntegrationPluginManifestCreate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupHelperWithManifest(t, rest.Mode5)

	gvr := schema.GroupVersionResource{
		Group:    testAppID,
		Version:  "v1",
		Resource: "things",
	}
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default",
		GVR:       gvr,
	})

	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": thingAPIVersion,
		"kind":       "Thing",
		"metadata": map[string]any{
			"name":      "thing-1",
			"namespace": "default",
		},
		"spec": map[string]any{"foo": "bar"},
	}}

	created, err := client.Resource.Create(context.Background(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = client.Resource.Delete(context.Background(), created.GetName(), metav1.DeleteOptions{})
	})

	// The persisted object must keep the plugin's group, not a foreign one.
	require.Equal(t, thingAPIVersion, created.GetAPIVersion())
	require.Equal(t, "Thing", created.GetKind())

	got, err := client.Resource.Get(context.Background(), "thing-1", metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, thingAPIVersion, got.GetAPIVersion())

	// LIST exercises the typed-list append in unified storage. Manifest kinds are backed by
	// an untyped object whose list uses an interface element type ([]resource.Object); the
	// append must not dereference the pointer to a value (which would not satisfy the
	// interface and panic with "reflect.Set: value of type ... is not assignable").
	list, err := client.Resource.List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, list.Items, 1)
	require.Equal(t, "thing-1", list.Items[0].GetName())
	require.Equal(t, thingAPIVersion, list.Items[0].GetAPIVersion())

	// Server-side apply exercises the managedFields/structured-merge-diff type converter,
	// which indexes models by the x-kubernetes-group-version-kind OpenAPI extension. Without
	// that extension on the served definition, apply fails with "no corresponding type for
	// <gvk>". This guards that the extension is present and the apply path works.
	applyObj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": thingAPIVersion,
		"kind":       "Thing",
		"metadata": map[string]any{
			"name":      "thing-1",
			"namespace": "default",
		},
		"spec": map[string]any{"foo": "baz"},
	}}
	applied, err := client.Resource.Apply(context.Background(), "thing-1", applyObj, metav1.ApplyOptions{
		Force:        true,
		FieldManager: "pluginmanifest-test",
	})
	require.NoError(t, err)
	require.Equal(t, thingAPIVersion, applied.GetAPIVersion())
}

// TestIntegrationPluginManifestServiceLoading verifies the manifest APIs are still served when
// plugins are loaded via the service-loading path (FlagPluginStoreServiceLoading), where the
// plugin registry is populated during service startup rather than at Wire-injection time. This
// path previously produced no installers because they were derived eagerly at injection time,
// before any plugin had loaded.
func TestIntegrationPluginManifestServiceLoading(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupHelperWithManifest(t, rest.Mode5, featuremgmt.FlagPluginStoreServiceLoading)

	disco, err := helper.GetGroupVersionInfoJSON(testAppID)
	require.NoError(t, err)
	require.Contains(t, disco, `"resource": "things"`)
}

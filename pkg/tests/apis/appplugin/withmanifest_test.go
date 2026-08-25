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

// Manifest APIs use the plugin ID as their group.
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

// TestIntegrationPluginManifestCreate covers CRUD and server-side apply for a manifest kind.
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

	require.Equal(t, thingAPIVersion, created.GetAPIVersion())
	require.Equal(t, "Thing", created.GetKind())

	got, err := client.Resource.Get(context.Background(), "thing-1", metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, thingAPIVersion, got.GetAPIVersion())

	// LIST exercises unified storage's unstructured list handling.
	list, err := client.Resource.List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, list.Items, 1)
	require.Equal(t, "thing-1", list.Items[0].GetName())
	require.Equal(t, thingAPIVersion, list.Items[0].GetAPIVersion())

	// Apply requires the manifest GVK in the OpenAPI definition.
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

// TestIntegrationPluginManifestServiceLoading covers manifests loaded during service startup.
func TestIntegrationPluginManifestServiceLoading(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupHelperWithManifest(t, rest.Mode5, featuremgmt.FlagPluginStoreServiceLoading)

	disco, err := helper.GetGroupVersionInfoJSON(testAppID)
	require.NoError(t, err)
	require.Contains(t, disco, `"resource": "things"`)
}

package appplugin

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
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

	// The generic create handler cannot diff an unstructured kind against the
	// kindless empty object the scheme hands it, so it drops managedFields; the
	// kind store redoes that diff. Without this a later apply has nothing to
	// merge against and every field looks unowned.
	fields := created.GetManagedFields()
	require.Len(t, fields, 1, "the create is tracked as one entry")
	require.Equal(t, thingAPIVersion, fields[0].APIVersion)
	require.Equal(t, metav1.ManagedFieldsOperationUpdate, fields[0].Operation)
	require.Contains(t, string(fields[0].FieldsV1.Raw), "f:spec")

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
	require.Equal(t, map[string]any{"foo": "baz"}, applied.Object["spec"])

	// The apply is recorded under its own manager, alongside the create's entry.
	managers := map[string]metav1.ManagedFieldsOperationType{}
	for _, f := range applied.GetManagedFields() {
		managers[f.Manager] = f.Operation
	}
	require.Equal(t, metav1.ManagedFieldsOperationApply, managers["pluginmanifest-test"])
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

	// Every namespaced manifest kind gets the generic search endpoints. They
	// name their own path, so they can never collide with a kind route, which is
	// always mounted under an object name.
	require.Contains(t, doc.Paths, prefix+"/search")
	require.Contains(t, doc.Paths, prefix+"/trash")

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

	// clientWrapper returns a ServiceUnavailable, but httpadapter.HandlerFunc
	// turns any CallRoute failure into a plain-text 500, so the status reason
	// and the k8s Status body are both lost on the way out.
	require.True(t, apierrors.IsInternalError(err), "got %v", err)
	require.Contains(t, string(raw), "does not implement the v3 route service")
}

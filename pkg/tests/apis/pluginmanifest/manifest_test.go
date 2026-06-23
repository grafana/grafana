package pluginmanifest

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
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const testPluginID = "test-app-with-sdk-manifest"

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationPluginManifestDiscovery(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupHelper(t)

	disco, err := helper.GetGroupVersionInfoJSON("testappwithsdkmanifest.ext.grafana.com")
	require.NoError(t, err)
	require.JSONEq(t, `[
		{
			"version": "v1",
			"freshness": "Current",
			"resources": [
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
								"kind": "ResourceCallOptions",
								"version": ""
							},
							"subresource": "reload",
							"verbs": [
								"get"
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
// process via klog.Fatalf if a referenced model definition (e.g. the SDK's
// EmptyObject, used for custom-route responses) cannot be resolved.
func TestIntegrationPluginManifestOpenAPIV2(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupHelper(t)

	disco := helper.NewDiscoveryClient()
	result := disco.RESTClient().Get().AbsPath("/openapi/v2").Do(context.Background())
	require.NoError(t, result.Error())

	var statusCode int
	result.StatusCode(&statusCode)
	require.Equal(t, 200, statusCode)

	raw, err := result.Raw()
	require.NoError(t, err)
	// The custom-route kind must appear in the built spec.
	require.Contains(t, string(raw), "testappwithsdkmanifest.ext.grafana.com")
}

// TestIntegrationPluginManifestCreate verifies a resource can be created and read back
// with its group intact. This guards against the shared-scheme group-mismatch bug, where
// the generic object type was registered under many groups and an unrelated group (e.g.
// quotas.grafana.app) could be stamped onto the created object, causing unified storage to
// reject the write with "group in key does not match group in the body".
func TestIntegrationPluginManifestCreate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setupHelper(t)

	gvr := schema.GroupVersionResource{
		Group:    "testappwithsdkmanifest.ext.grafana.com",
		Version:  "v1",
		Resource: "things",
	}
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default",
		GVR:       gvr,
	})

	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "testappwithsdkmanifest.ext.grafana.com/v1",
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
	require.Equal(t, "testappwithsdkmanifest.ext.grafana.com/v1", created.GetAPIVersion())
	require.Equal(t, "Thing", created.GetKind())

	got, err := client.Resource.Get(context.Background(), "thing-1", metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, "testappwithsdkmanifest.ext.grafana.com/v1", got.GetAPIVersion())

	// LIST exercises the typed-list append in unified storage. Manifest kinds are backed by
	// an untyped object whose list uses an interface element type ([]resource.Object); the
	// append must not dereference the pointer to a value (which would not satisfy the
	// interface and panic with "reflect.Set: value of type ... is not assignable").
	list, err := client.Resource.List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, list.Items, 1)
	require.Equal(t, "thing-1", list.Items[0].GetName())
	require.Equal(t, "testappwithsdkmanifest.ext.grafana.com/v1", list.Items[0].GetAPIVersion())

	// Server-side apply exercises the managedFields/structured-merge-diff type converter,
	// which indexes models by the x-kubernetes-group-version-kind OpenAPI extension. Without
	// that extension on the served definition, apply fails with "no corresponding type for
	// <gvk>". This guards that the extension is present and the apply path works.
	applyObj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "testappwithsdkmanifest.ext.grafana.com/v1",
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
	require.Equal(t, "testappwithsdkmanifest.ext.grafana.com/v1", applied.GetAPIVersion())
}

func setupHelper(t *testing.T) *apis.K8sTestHelper {
	t.Helper()

	dir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagPluginsAppSDKManifest,
		},
	})

	_, thisFile, _, ok := runtime.Caller(0)
	require.True(t, ok)
	testPluginSrc := filepath.Join(filepath.Dir(thisFile), "testdata", testPluginID)
	testPluginDst := filepath.Join(dir, "plugins", testPluginID)

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

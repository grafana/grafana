package provisioning

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationProvisioning(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // Required to start the example service
		},
	})

	t.Run("Check discovery client", func(t *testing.T) {
		disco := helper.NewDiscoveryClient()
		resources, err := disco.ServerResourcesForGroupVersion("provisioning.grafana.app/v0alpha1")
		require.NoError(t, err)

		v1Disco, err := json.MarshalIndent(resources, "", "  ")
		require.NoError(t, err)
		//fmt.Printf("%s", string(v1Disco))
		require.JSONEq(t, `{
			"kind": "APIResourceList",
			"apiVersion": "v1",
			"groupVersion": "provisioning.grafana.app/v0alpha1",
			"resources": [
				{
					"name": "repositories",
					"singularName": "repository",
					"namespaced": true,
					"kind": "Repository",
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
					"name": "repositories/hello",
					"singularName": "",
					"kind": "HelloWorld",
					"namespaced": true,
					"verbs": [
						"get"
					]
				}
			]
		}`, string(v1Disco))
	})

	t.Run("Check basic create and get", func(t *testing.T) {
		// Scope create+get
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: "default", // actually org1
			GVR: schema.GroupVersionResource{
				Group: "provisioning.grafana.app", Version: "v0alpha1", Resource: "repositories",
			},
		})
		createOptions := metav1.CreateOptions{FieldValidation: "Strict"}
		r0, err := client.Resource.Create(ctx,
			helper.LoadYAMLOrJSONFile("testdata/local-devenv.yaml"),
			createOptions,
		)

		require.NoError(t, err)
		require.Equal(t, "devenv", r0.GetName())
		r1, err := client.Resource.Get(ctx, "devenv", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t,
			mustNestedString(r0.Object, "spec", "local", "path"),
			mustNestedString(r1.Object, "spec", "local", "path"),
		)
		require.Equal(t,
			"path/to/folder", //
			mustNestedString(r1.Object, "spec", "local", "path"),
		)
	})

	t.Run("basic helloworld subresource", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: "default", // actually org1
			GVR: schema.GroupVersionResource{
				Group:    "provisioning.grafana.app",
				Version:  "v0alpha1",
				Resource: "repositories",
			},
		})

		resp, err := client.Resource.Get(ctx, "test", metav1.GetOptions{}, "hello")
		require.NoError(t, err)
		require.Equal(t,
			"World",
			mustNestedString(resp.Object, "whom"))
	})
}

func mustNestedString(obj map[string]interface{}, fields ...string) string {
	v, _, _ := unstructured.NestedString(obj, fields...)
	return v
}

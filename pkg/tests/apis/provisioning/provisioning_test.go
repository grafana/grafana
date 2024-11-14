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
		// fmt.Printf("%s", string(v1Disco))
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

		// Load the samples
		_, err := client.Resource.Create(ctx,
			helper.LoadYAMLOrJSONFile("testdata/local-devenv.yaml"),
			createOptions,
		)
		require.NoError(t, err)

		_, err = client.Resource.Create(ctx,
			helper.LoadYAMLOrJSONFile("testdata/github-example.yaml"),
			createOptions,
		)
		require.NoError(t, err)

		_, err = client.Resource.Create(ctx,
			helper.LoadYAMLOrJSONFile("testdata/s3-example.yaml"),
			createOptions,
		)
		require.NoError(t, err)

		samples, err := client.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		found := map[string]any{}
		for _, v := range samples.Items {
			found[v.GetName()] = v.Object["spec"]
		}

		js, _ := json.MarshalIndent(found, "", "  ")
		// fmt.Printf("%s", string(js))
		require.JSONEq(t, `{
			"github-example": {
				"description": "load resources from github",
				"github": {
					"branchWorkflow": true,
					"generateDashboardPreviews": true,
					"owner": "grafana",
					"repository": "git-ui-sync-demo"
				},
				"title": "Github Example",
				"type": "github"
			},
			"local-devenv": {
				"description": "load resources from grafana/grafana devenv folder",
				"local": {
					"path": "path/to/folder"
				},
				"title": "Local devenv files",
				"type": "local"
			},
			"s3-example": {
				"description": "load resources from an S3 bucket",
				"s3": {
					"bucket": "my-bucket",
					"region": "us-west-1"
				},
				"title": "S3 Example",
				"type": "s3"
			}
		}`, string(js))
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

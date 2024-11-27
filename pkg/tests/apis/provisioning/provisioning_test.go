package provisioning

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
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
			featuremgmt.FlagProvisioning,
			featuremgmt.FlagKubernetesFolders,                    // Required for tests that deal with folders.
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // !!!
		},
	})
	helper.GetEnv().GitHubMockFactory.Constructor = func(ttc github.TestingTWithCleanup) github.Client {
		client := github.NewMockClient(ttc)
		client.On("ListWebhooks", mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil, nil)
		client.On("CreateWebhook", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)
		// Don't need DeleteWebhook or EditWebhook, because they require that ListWebhooks returns a slice with elements.
		return client
	}

	// Scope create+get
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR: schema.GroupVersionResource{
			Group: "provisioning.grafana.app", Version: "v0alpha1", Resource: "repositories",
		},
	})

	folderClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR: schema.GroupVersionResource{
			Group: "folder.grafana.app", Version: "v0alpha1", Resource: "folders",
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
					"name": "repositories/export",
					"singularName": "",
					"namespaced": true,
					"kind": "ResourceWrapper",
					"verbs": [
						"create",
						"get"
					]
				},
				{
					"name": "repositories/files",
					"singularName": "",
					"namespaced": true,
					"kind": "ResourceWrapper",
					"verbs": [
						"create",
						"delete",
						"get",
						"update"
					]
				},
				{
					"name": "repositories/hello",
					"singularName": "",
					"namespaced": true,
					"kind": "HelloWorld",
					"verbs": [
						"get"
					]
				},
				{
					"name": "repositories/status",
					"singularName": "",
					"namespaced": true,
					"kind": "Repository",
					"verbs": [
						"get",
						"patch",
						"update"
					]
				},
				{
					"name": "repositories/webhook",
					"singularName": "",
					"namespaced": true,
					"kind": "WebhookResponse",
					"verbs": [
						"create",
						"get"
					]
				}
			]
		}`, string(v1Disco))
	})

	t.Run("Check basic create and get", func(t *testing.T) {
		createOptions := metav1.CreateOptions{FieldValidation: "Strict"}

		// Load the samples
		_, err := client.Resource.Create(ctx,
			helper.LoadYAMLOrJSONFile("testdata/local-conf-provisioning-sample.yaml"),
			createOptions,
		)
		require.NoError(t, err)

		_, err = client.Resource.Create(ctx,
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
		require.JSONEq(t, `{
			"github-example": {
				"description": "load resources from github",
				"folder": "thisisafolderref",
				"editing": {
					"create": true,
					"delete": true,
					"update": true
				},
				"github": {
					"branch": "dummy-branch",
					"branchWorkflow": true,
					"generateDashboardPreviews": true,
					"owner": "grafana",
					"repository": "git-ui-sync-demo",
					"token": "github_pat_dummy",
					"webhookSecret": "dummyWebhookSecret",
					"webhookURL": "http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/github-example/webhook"
				},
				"title": "Github Example",
				"type": "github"
			},
			"local-conf-provisioning-sample": {
				"description": "load resources from https://github.com/grafana/grafana/tree/main/conf/provisioning/sample",
				"editing": {
					"create": true,
					"delete": true,
					"update": true
				},
				"local": {
					"path": "provisioning/sample"
				},
				"title": "Config provisioning files",
				"type": "local"
			},
			"local-devenv": {
				"description": "load https://github.com/grafana/grafana/tree/main/devenv/dev-dashboards",
				"editing": {
					"create": true,
					"delete": true,
					"update": true
				},
				"local": {
					"path": "devenv/dev-dashboards"
				},
				"title": "Load devenv dashboards",
				"folder": "testingtesting",
				"type": "local"
			},
			"s3-example": {
				"description": "load resources from an S3 bucket",
				"editing": {
					"create": false,
					"delete": false,
					"update": false
				},
				"s3": {
					"bucket": "my-bucket",
					"region": "us-west-1"
				},
				"title": "S3 Example",
				"type": "s3"
			}
		}`, string(js))
	})

	t.Run("validation hooks", func(t *testing.T) {
		// Add it if this is the only test that ran
		obj, err := client.Resource.Create(ctx,
			helper.LoadYAMLOrJSONFile("testdata/invalid.yaml"),
			metav1.CreateOptions{},
		)
		require.Nil(t, obj)
		require.Error(t, err)
	})

	t.Run("basic helloworld subresource", func(t *testing.T) {
		// Add it if this is the only test that ran
		_, err := client.Resource.Update(ctx,
			helper.LoadYAMLOrJSONFile("testdata/github-example.yaml"),
			metav1.UpdateOptions{},
		)
		require.NoError(t, err)

		// "test" is Not found
		resp, err := client.Resource.Get(ctx, "test", metav1.GetOptions{}, "hello")
		require.Error(t, err) // "test" not found
		require.Nil(t, resp)  // "test" not found

		resp, err = client.Resource.Get(ctx, "github-example", metav1.GetOptions{}, "hello")
		require.NoError(t, err)
		require.Equal(t,
			"World",
			mustNestedString(resp.Object, "whom"))
	})

	t.Run("creating repository creates folder", func(t *testing.T) {
		// Just make sure the folder doesn't exist in advance.
		err := folderClient.Resource.Delete(ctx, "thisisafolderref", metav1.DeleteOptions{})
		if err != nil && !errors.IsNotFound(err) {
			require.NoError(t, err, "deletion should either be OK or fail with NotFound")
		}

		_, err = client.Resource.Update(ctx,
			helper.LoadYAMLOrJSONFile("testdata/github-example.yaml"),
			metav1.UpdateOptions{},
		)
		require.NoError(t, err)

		resp, err := folderClient.Resource.Get(ctx, "thisisafolderref", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "thisisafolderref", mustNestedString(resp.Object, "metadata", "name"))
	})
}

func mustNestedString(obj map[string]interface{}, fields ...string) string {
	v, _, _ := unstructured.NestedString(obj, fields...)
	return v
}

package provisioning

import (
	"context"
	"encoding/json"
	"math/rand"
	"os"
	"path"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboard "github.com/grafana/grafana/pkg/apis/dashboard/v1alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
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

	provisioningPath := t.TempDir()
	ctx := context.Background()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		EnableFeatureToggles: []string{
			featuremgmt.FlagProvisioning,
			featuremgmt.FlagKubernetesFolders, // Required for tests that deal with folders.
		},
		PermittedProvisioningPaths: ".|" + provisioningPath,
	})
	helper.GetEnv().GitHubMockFactory.Constructor = func(ttc github.TestingTWithCleanup) github.Client {
		client := github.NewMockClient(ttc)
		client.On("IsAuthenticated", mock.Anything).Maybe().Return(nil)
		client.On("ListWebhooks", mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil, nil)
		client.On("CreateWebhook", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(github.WebhookConfig{}, nil)
		client.On("RepoExists", mock.Anything, mock.Anything, mock.Anything).Maybe().Return(true, nil)
		client.On("BranchExists", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(true, nil)
		client.On("GetBranch", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(github.Branch{Sha: "testing"}, nil)
		client.On("GetTree", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil, false, nil)
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

	jobClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR: schema.GroupVersionResource{
			Group: "provisioning.grafana.app", Version: "v0alpha1", Resource: "jobs",
		},
	})

	// Repo client, but less guard rails.
	restClient := helper.Org1.Admin.RESTClient(t, &schema.GroupVersion{
		Group: "provisioning.grafana.app", Version: "v0alpha1",
	})

	folderClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR: schema.GroupVersionResource{
			Group: "folder.grafana.app", Version: "v0alpha1", Resource: "folders",
		},
	})

	dashboardClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR: schema.GroupVersionResource{
			Group: dashboard.GROUP, Version: dashboard.VERSION, Resource: "dashboards",
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
					"name": "jobs",
					"singularName": "job",
					"namespaced": true,
					"kind": "Job",
					"verbs": [
						"get",
						"list",
						"watch"
					]
				},
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
					"kind": "Job",
					"verbs": [
						"create"
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
					"name": "repositories/history",
					"singularName": "",
					"namespaced": true,
					"kind": "HistoryList",
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
					"name": "repositories/sync",
					"singularName": "",
					"namespaced": true,
					"kind": "Job",
					"verbs": [
						"create"
					]
				},
				{
					"name": "repositories/test",
					"singularName": "",
					"namespaced": true,
					"kind": "TestResults",
					"verbs": [
						"create"
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

		// also verify the openapi
		helper.VerifyStaticOpenAPISpec(schema.GroupVersion{
			Group: "provisioning.grafana.app", Version: "v0alpha1",
		}, "testdata/openapi.json")
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
					"pullRequestLinter": true,
					"repository": "git-ui-sync-demo",
					"token": "github_pat_dummy"
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

		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			resp, err := folderClient.Resource.Get(ctx, "thisisafolderref", metav1.GetOptions{})
			require.NoError(collect, err)
			require.Equal(collect, "thisisafolderref", mustNestedString(resp.Object, "metadata", "name"))
		}, time.Second*2, time.Millisecond*20)
	})

	t.Run("safe path usages", func(t *testing.T) {
		// Just make sure the folder doesn't exist in advance.
		err := folderClient.Resource.Delete(ctx, "thisisafolderref", metav1.DeleteOptions{})
		if err != nil && !errors.IsNotFound(err) {
			require.NoError(t, err, "deletion should either be OK or fail with NotFound")
		}

		_, err = client.Resource.Update(ctx,
			helper.LoadYAMLOrJSONFile("testdata/local-devenv.yaml"),
			metav1.UpdateOptions{},
		)
		require.NoError(t, err)

		const repo = "local-devenv"
		result := restClient.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "all-panels.json").
			Body(helper.LoadFile("testdata/all-panels.json")).
			Do(ctx)
		require.NoError(t, result.Error(), "expecting to be able to create file")

		result = restClient.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "test", "..", "..", "all-panels.json").
			Body(helper.LoadFile("testdata/all-panels.json")).
			Do(ctx)
		require.Error(t, result.Error(), "invalid path should return error")

		_, err = client.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "all-panels.json")
		require.NoError(t, err, "valid path should be fine")

		_, err = client.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "../../all-panels.json")
		require.Error(t, err, "invalid path should not be fine")
	})

	t.Run("import all-panels from local-repository", func(t *testing.T) {
		// Just make sure the folder doesn't exist in advance.
		err := folderClient.Resource.Delete(ctx, "thisisafolderref", metav1.DeleteOptions{})
		if err != nil && !errors.IsNotFound(err) {
			require.NoError(t, err, "deletion should either be OK or fail with NotFound")
		}

		const repo = "local-tmp"
		err = client.Resource.Delete(ctx, repo, metav1.DeleteOptions{})
		if err != nil && !errors.IsNotFound(err) {
			require.NoError(t, err, "deletion should either be OK or fail with NotFound")
		}

		// Create the repository.
		repoPath := path.Join(provisioningPath, repo, randomAsciiStr(10))
		err = os.MkdirAll(repoPath, 0700)
		require.NoError(t, err, "should be able to create repo path")
		localTmp := helper.LoadYAMLOrJSONFile("testdata/local-tmp.yaml")
		require.NoError(t, unstructured.SetNestedField(localTmp.Object, repoPath, "spec", "local", "path"))

		_, err = client.Resource.Create(ctx, localTmp, metav1.CreateOptions{})
		require.NoError(t, err)

		err = os.WriteFile(path.Join(repoPath, "all-panels.json"), helper.LoadFile("testdata/all-panels.json"), 0600)
		require.NoError(t, err, "expecting to be able to create file")

		// Make sure the repo can see the file
		_, err = client.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "all-panels.json")
		require.NoError(t, err, "valid path should be fine")

		// But the dashboard shouldn't exist yet
		_, err = dashboardClient.Resource.Get(ctx, "n1jR8vnnz", metav1.GetOptions{})
		require.Error(t, err, "no all-panels dashboard should exist")

		// Now, we import it, such that it may exist
		result := restClient.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("sync").
			Do(ctx)

		obj, err := result.Get()
		require.NoError(t, err, "expecting to be able to sync repository")

		obj2, ok := obj.(*unstructured.Unstructured)
		if !ok {
			require.Fail(t, "expected unstructured response, %T", obj)
		}
		job := obj2.GetName()
		require.NotEmpty(t, job)

		// Wait for the async job to finish
		for i := 0; i < 10; i++ {
			time.Sleep(time.Millisecond * 250)
			job, err := jobClient.Resource.Get(ctx, job, metav1.GetOptions{})
			require.NoError(t, err)

			state, _, err := unstructured.NestedString(job.Object, "status", "state")
			require.NoError(t, err)
			if state == string(provisioning.JobStateFinished) || state == string(provisioning.JobStateError) {
				break
			}
		}

		found, err := dashboardClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "can list values")

		names := []string{}
		for _, v := range found.Items {
			names = append(names, v.GetName())
		}
		require.Contains(t, names, "all-panels-5Y4ReX6LwL7d", "all-panels dashboard should now exist")
	})
}

func mustNestedString(obj map[string]interface{}, fields ...string) string {
	v, _, _ := unstructured.NestedString(obj, fields...)
	return v
}

func randomAsciiStr(n int) string {
	const alphabet string = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
	b := strings.Builder{}
	b.Grow(n)
	for range n {
		char := alphabet[rand.Intn(len(alphabet))]
		b.WriteByte(char)
	}
	return b.String()
}

func objectToUnstructured(t *testing.T, obj runtime.Object) *unstructured.Unstructured {
	t.Helper()

	encoded, err := json.Marshal(obj)
	require.NoError(t, err)

	out := new(unstructured.Unstructured)
	_, _, err = unstructured.UnstructuredJSONScheme.Decode(encoded, nil, out)
	require.NoError(t, err)

	return out
}

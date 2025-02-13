package provisioning

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/rand"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboard "github.com/grafana/grafana/pkg/apis/dashboard/v1alpha1"
	folder "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
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
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagKubernetesCliDashboards,
			featuremgmt.FlagKubernetesFoldersServiceV2,
			featuremgmt.FlagUnifiedStorageSearch,
		},
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"dashboards.dashboard.grafana.app": {
				DualWriterMode: rest.Mode5,
			},
			"folders.folder.grafana.app": {
				DualWriterMode: rest.Mode5,
			},
		},
		PermittedProvisioningPaths: ".|" + provisioningPath,
	})

	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       provisioning.RepositoryResourceInfo.GroupVersionResource(),
	})

	jobClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       provisioning.JobResourceInfo.GroupVersionResource(),
	})

	folderClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       folder.FolderResourceInfo.GroupVersionResource(),
	})

	dashboardClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       dashboard.DashboardResourceInfo.GroupVersionResource(),
	})

	// Repo client, but less guard rails. Useful for subresources. We'll need this later...
	restClient := helper.Org1.Admin.RESTClient(t, &schema.GroupVersion{
		Group: "provisioning.grafana.app", Version: "v0alpha1",
	})
	_ = restClient

	cleanSlate := func(t *testing.T) {
		helper.GetEnv().GitHubMockFactory.Constructor = func(ttc github.TestingTWithCleanup) github.Client {
			client := github.NewMockClient(ttc)
			client.On("IsAuthenticated", mock.Anything).Maybe().Return(nil)
			client.On("ListWebhooks", mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil, nil)
			client.On("CreateWebhook", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(github.WebhookConfig{}, nil)
			client.On("RepoExists", mock.Anything, mock.Anything, mock.Anything).Maybe().Return(true, nil)
			client.On("BranchExists", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(true, nil)
			client.On("GetBranch", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(github.Branch{Sha: "testing"}, nil)
			client.On("GetTree", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil, false, nil)
			client.On("DeleteWebhook", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)
			return client
		}

		deleteAll := func(client *apis.K8sResourceClient) error {
			list, err := client.Resource.List(ctx, metav1.ListOptions{})
			if err != nil {
				return err
			}
			for _, resource := range list.Items {
				if err := client.Resource.Delete(ctx, resource.GetName(), metav1.DeleteOptions{}); err != nil {
					return err
				}
			}
			return nil
		}

		require.NoError(t, deleteAll(dashboardClient), "deleting all dashboards")
		require.NoError(t, deleteAll(folderClient), "deleting all folders")
		require.NoError(t, deleteAll(client), "deleting all repositories")
	}
	cleanSlate(t)

	t.Run("Creating and getting repositories", func(t *testing.T) {
		cleanSlate(t)

		createOptions := metav1.CreateOptions{FieldValidation: "Strict"}

		for _, inputFilePath := range []string{
			"testdata/github-example.json",
			"testdata/local-conf-provisioning-sample.json",
			"testdata/local-devenv.json",
			"testdata/local-tmp.json",
			"testdata/local-xxx.json",
		} {
			t.Run(inputFilePath, func(t *testing.T) {
				input := helper.LoadYAMLOrJSONFile(inputFilePath)
				expectedOutput, err := json.MarshalIndent(input.Object["spec"], "", "  ")
				require.NoError(t, err, "failed to marshal JSON from input spec")

				_, err = client.Resource.Create(ctx, input, createOptions)
				require.NoError(t, err, "failed to create resource")

				output, err := client.Resource.Get(ctx, mustNestedString(input.Object, "metadata", "name"), metav1.GetOptions{})
				require.NoError(t, err, "failed to read back resource")
				outputJSON, err := json.MarshalIndent(output.Object["spec"], "", "  ")
				require.NoError(t, err, "failed to marshal JSON from read back resource")

				require.JSONEq(t, string(expectedOutput), string(outputJSON))
			})
		}
	})

	t.Run("creating GitHub repository syncs from branch selected", func(t *testing.T) {
		cleanSlate(t)

		var githubClient *github.MockClient
		helper.GetEnv().GitHubMockFactory.Constructor = func(ttc github.TestingTWithCleanup) github.Client {
			if githubClient != nil {
				return githubClient
			}
			githubClient = github.NewMockClient(ttc)

			isCtx := mock.Anything // mock.IsType(context.Background())
			owner := "grafana"
			repo := "git-ui-sync-demo"
			branch := "dummy-branch"
			sha := "24a55f601e33048d2267943279fc7f1b39b35e58"

			// Possible remnants of cleanSlate
			githubClient.On("DeleteWebhook", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)

			// Ensuring we pass Test
			githubClient.On("IsAuthenticated", isCtx).Return(nil)
			githubClient.On("RepoExists", isCtx, owner, repo).Return(true, nil)
			githubClient.On("BranchExists", isCtx, owner, repo, branch).Return(true, nil)

			// Ensuring we can set up the webhook (even if it doesn't really... do anything here)
			githubClient.On("CreateWebhook", isCtx, owner, repo, mock.Anything /* cfg */).Return(github.WebhookConfig{ID: 123}, nil)

			// Ensuring we can successfully sync two files
			githubClient.On("GetBranch", isCtx, owner, repo, branch).Return(github.Branch{Name: branch, Sha: sha}, nil)
			githubClient.On("GetTree", isCtx, owner, repo, sha /* ref */, mock.IsType(false) /* recursive */).
				Return([]github.RepositoryContent{
					mockRepositoryContent("README.md", "# Hello, World!"),
					mockRepositoryContent("dashboard.json", string(helper.LoadFile("testdata/all-panels.json"))),
					mockRepositoryContent("subdir/dashboard2.yaml", string(helper.LoadFile("testdata/text-options.json"))),
				}, /* truncated */ false /* err */, nil)
			githubClient.On("GetContents", isCtx /* ctx */, owner, repo, "dashboard.json" /* filePath */, sha /* ref */).
				Return(mockRepositoryContent("dashboard.json", string(helper.LoadFile("testdata/all-panels.json"))) /* content */, nil /* dirContent */, nil /* err */)
			githubClient.On("GetContents", isCtx /* ctx */, owner, repo, "subdir/dashboard2.yaml" /* filePath */, sha /* ref */).
				Return(mockRepositoryContent("subdir/dashboard2.yaml", string(helper.LoadFile("testdata/text-options.json"))) /* content */, nil /* dirContent */, nil /* err */)
			return githubClient
		}

		_, err := client.Resource.Update(ctx,
			helper.LoadYAMLOrJSONFile("testdata/github-example.json"),
			metav1.UpdateOptions{},
		)
		require.NoError(t, err)

		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			list, err := jobClient.Resource.List(ctx, metav1.ListOptions{})
			if assert.NoError(collect, err) {
				for _, elem := range list.Items {
					state := mustNestedString(elem.Object, "status", "state")
					if elem.GetLabels()["repository"] == "github-example" {
						if state == string(provisioning.JobStateSuccess) {
							continue // doesn't matter
						}
						require.NotEqual(t, provisioning.JobStateError, state, "no jobs may error, but %s did", elem.GetName())
						collect.Errorf("there are still remaining github-example jobs: %v", elem)
						return
					}
				}
			}

			repo, err := client.Resource.Get(ctx, "github-example", metav1.GetOptions{})
			if assert.NoError(collect, err) {
				assert.Equal(collect, true, mustNested(repo.Object, "status", "health", "healthy"))
				assert.Equal(collect, "success", mustNestedString(repo.Object, "status", "sync", "state"))
			}
		}, time.Second*5, time.Millisecond*20)

		// By now, we should have synced, meaning we have data to read in the local Grafana instance!

		found, err := dashboardClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "can list values")

		names := []string{}
		for _, v := range found.Items {
			names = append(names, v.GetName())
		}
		require.Contains(t, names, "dashboard-R-GC4gTF44qh", "should contain dashboard.json's contents")
		require.Contains(t, names, "dashboard2-1jw3H-Mqm75v", "should contain dashboard2.yaml's contents")
	})

	t.Run("safe path usages", func(t *testing.T) {
		cleanSlate(t)

		_, err := client.Resource.Update(ctx,
			helper.LoadYAMLOrJSONFile("testdata/local-devenv.json"),
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
		cleanSlate(t)

		const repo = "local-tmp"
		// Create the repository.
		repoPath := path.Join(provisioningPath, repo, randomAsciiStr(10))
		err := os.MkdirAll(repoPath, 0700)
		require.NoError(t, err, "should be able to create repo path")
		localTmp := helper.LoadYAMLOrJSONFile("testdata/local-tmp.json")
		require.NoError(t, unstructured.SetNestedField(localTmp.Object, repoPath, "spec", "local", "path"))

		_, err = client.Resource.Create(ctx, localTmp, metav1.CreateOptions{})
		require.NoError(t, err)

		err = os.WriteFile(path.Join(repoPath, "all-panels.json"), helper.LoadFile("testdata/all-panels.json"), 0600)
		require.NoError(t, err, "expecting to be able to create file")

		// Make sure the repo can see the file
		_, err = client.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "all-panels.json")
		require.NoError(t, err, "valid path should be fine")

		// But the dashboard shouldn't exist yet
		const allPanels = "all-panels-hallaxjov44rbumtikbi1sbzroco9"
		_, err = dashboardClient.Resource.Get(ctx, allPanels, metav1.GetOptions{})
		require.Error(t, err, "no all-panels dashboard should exist")

		// Now, we import it, such that it may exist
		result := restClient.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("sync").
			Body(asJSON(provisioning.SyncJobOptions{
				Incremental: false,
			})).
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
			if provisioning.JobState(state).Finished() {
				break
			}
		}

		found, err := dashboardClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "can list values")

		names := []string{}
		for _, v := range found.Items {
			names = append(names, v.GetName())
		}
		require.Contains(t, names, allPanels, "all-panels dashboard should now exist")
	})
}

func mustNestedString(obj map[string]interface{}, fields ...string) string {
	v, _, _ := unstructured.NestedString(obj, fields...)
	return v
}

func mustNested(obj map[string]interface{}, fields ...string) interface{} {
	v, _, _ := unstructured.NestedFieldNoCopy(obj, fields...)
	return v
}

func asJSON(obj any) []byte {
	jj, _ := json.Marshal(obj)
	return jj
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

func mockRepositoryContent(path string, content string) github.RepositoryContent {
	hash := sha256.Sum256([]byte(content))

	return mockContent{
		isDir:       strings.HasSuffix(path, "/"),
		fileContent: content,
		isSymlink:   false,
		path:        path,
		sha:         hex.EncodeToString(hash[:]),
		size:        int64(len(content)),
	}
}

type mockContent struct {
	isDir          bool
	fileContent    string
	fileContentErr error
	isSymlink      bool
	path           string
	sha            string
	size           int64
}

func (c mockContent) IsDirectory() bool {
	return c.isDir
}

func (c mockContent) GetFileContent() (string, error) {
	return c.fileContent, c.fileContentErr
}

func (c mockContent) IsSymlink() bool {
	return c.isSymlink
}

func (c mockContent) GetPath() string {
	return c.path
}

func (c mockContent) GetSHA() string {
	return c.path
}

func (c mockContent) GetSize() int64 {
	return c.size
}

var _ github.RepositoryContent = mockContent{}

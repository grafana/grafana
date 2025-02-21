package provisioning

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"path"
	"regexp"
	"strings"
	"testing"
	"time"

	gh "github.com/google/go-github/v69/github"
	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/rand"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"

	dashboard "github.com/grafana/grafana/pkg/apis/dashboard/v1alpha1"
	folder "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

type provisioningTestHelper struct {
	*apis.K8sTestHelper
	ProvisioningPath string

	Repositories *apis.K8sResourceClient
	Jobs         *apis.K8sResourceClient
	Folders      *apis.K8sResourceClient
	Dashboards   *apis.K8sResourceClient
	REST         *rest.RESTClient
}

type grafanaOption func(opts *testinfra.GrafanaOpts)

// Useful for debugging a test in development.
//
//lint:ignore U1000 This is used when needed while debugging.
//nolint:golint,unused
func withLogs(opts *testinfra.GrafanaOpts) {
	opts.EnableLog = true
}

func runGrafana(t *testing.T, options ...grafanaOption) *provisioningTestHelper {
	provisioningPath := t.TempDir()
	opts := testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		EnableFeatureToggles: []string{
			featuremgmt.FlagProvisioning,
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagUnifiedStorageSearch,
			featuremgmt.FlagKubernetesClientDashboardsFolders,
		},
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"dashboards.dashboard.grafana.app": {
				DualWriterMode: grafanarest.Mode5,
			},
			"folders.folder.grafana.app": {
				DualWriterMode: grafanarest.Mode5,
			},
		},
		PermittedProvisioningPaths: ".|" + provisioningPath,
	}
	for _, o := range options {
		o(&opts)
	}
	helper := apis.NewK8sTestHelper(t, opts)

	helper.GetEnv().GitHubFactory.Client = ghmock.NewMockedHTTPClient(
		ghmock.WithRequestMatchHandler(ghmock.GetUser, ghAlwaysWrite(t, &gh.User{})),
		ghmock.WithRequestMatchHandler(ghmock.GetReposHooksByOwnerByRepo, ghAlwaysWrite(t, []*gh.Hook{})),
		ghmock.WithRequestMatchHandler(ghmock.PostReposHooksByOwnerByRepo, ghAlwaysWrite(t, &gh.Hook{})),
		ghmock.WithRequestMatchHandler(ghmock.GetReposByOwnerByRepo, ghAlwaysWrite(t, &gh.Repository{})),
		ghmock.WithRequestMatchHandler(ghmock.GetReposBranchesByOwnerByRepoByBranch, ghAlwaysWrite(t, &gh.Branch{})),
		ghmock.WithRequestMatchHandler(ghmock.GetReposGitTreesByOwnerByRepoByTreeSha, ghAlwaysWrite(t, &gh.Tree{})),
		ghmock.WithRequestMatchHandler(
			ghmock.DeleteReposHooksByOwnerByRepoByHookId,
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusOK)
			}),
		),
	)

	repositories := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       provisioning.RepositoryResourceInfo.GroupVersionResource(),
	})
	jobs := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       provisioning.JobResourceInfo.GroupVersionResource(),
	})
	folders := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       folder.FolderResourceInfo.GroupVersionResource(),
	})
	dashboards := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       dashboard.DashboardResourceInfo.GroupVersionResource(),
	})

	// Repo client, but less guard rails. Useful for subresources. We'll need this later...
	restClient := helper.Org1.Admin.RESTClient(t, &schema.GroupVersion{
		Group: "provisioning.grafana.app", Version: "v0alpha1",
	})

	deleteAll := func(client *apis.K8sResourceClient) error {
		ctx := context.Background()
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

	require.NoError(t, deleteAll(dashboards), "deleting all dashboards")
	require.NoError(t, deleteAll(folders), "deleting all folders")
	require.NoError(t, deleteAll(repositories), "deleting all repositories")

	return &provisioningTestHelper{
		ProvisioningPath: provisioningPath,
		K8sTestHelper:    helper,

		Repositories: repositories,
		REST:         restClient,
		Jobs:         jobs,
		Folders:      folders,
		Dashboards:   dashboards,
	}
}

func ghAlwaysWrite(t *testing.T, body any) http.HandlerFunc {
	marshalled := ghmock.MustMarshal(body)
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, err := w.Write(marshalled)
		require.NoError(t, err, "failed to write body in mock")
	})
}

func TestIntegrationProvisioning_CreatingAndGetting(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	createOptions := metav1.CreateOptions{FieldValidation: "Strict"}
	ctx := context.Background()

	for _, inputFilePath := range []string{
		"testdata/github-example.json",
		"testdata/local-conf-provisioning-sample.json",
		"testdata/local-devenv.json",
		"testdata/local-tmp.json",
		"testdata/local-xxx.json",
	} {
		t.Run(inputFilePath, func(t *testing.T) {
			input := helper.LoadYAMLOrJSONFile(inputFilePath)

			_, err := helper.Repositories.Resource.Create(ctx, input, createOptions)
			require.NoError(t, err, "failed to create resource")

			output, err := helper.Repositories.Resource.Get(ctx, mustNestedString(input.Object, "metadata", "name"), metav1.GetOptions{})
			require.NoError(t, err, "failed to read back resource")

			// Move encrypted token mutation
			token, found, err := unstructured.NestedString(output.Object, "spec", "github", "encryptedToken")
			require.NoError(t, err, "encryptedToken is not a string")
			if found {
				unstructured.RemoveNestedField(input.Object, "spec", "github", "token")
				err = unstructured.SetNestedField(input.Object, token, "spec", "github", "encryptedToken")
				require.NoError(t, err, "unable to copy encrypted token")
			}

			expectedOutput, err := json.MarshalIndent(input.Object["spec"], "", "  ")
			require.NoError(t, err, "failed to marshal JSON from input spec")
			outputJSON, err := json.MarshalIndent(output.Object["spec"], "", "  ")
			require.NoError(t, err, "failed to marshal JSON from read back resource")
			require.JSONEq(t, string(expectedOutput), string(outputJSON))
		})
	}
}

func TestIntegrationProvisioning_CreatingGitHubRepository(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	helper.GetEnv().GitHubFactory.Client = ghmock.NewMockedHTTPClient(
		ghmock.WithRequestMatchHandler(ghmock.GetUser, ghAlwaysWrite(t, &gh.User{Name: gh.Ptr("github-user")})),
		ghmock.WithRequestMatchHandler(ghmock.GetReposHooksByOwnerByRepo, ghAlwaysWrite(t, []*gh.Hook{})),
		ghmock.WithRequestMatchHandler(ghmock.PostReposHooksByOwnerByRepo, ghAlwaysWrite(t, &gh.Hook{ID: gh.Ptr(int64(123))})),
		ghmock.WithRequestMatchHandler(ghmock.GetReposByOwnerByRepo, ghAlwaysWrite(t, &gh.Repository{ID: gh.Ptr(int64(234))})),
		ghmock.WithRequestMatchHandler(
			ghmock.GetReposBranchesByOwnerByRepoByBranch,
			ghAlwaysWrite(t, &gh.Branch{
				Name:   gh.Ptr("main"),
				Commit: &gh.RepositoryCommit{SHA: gh.Ptr("deadbeef")},
			}),
		),
		ghmock.WithRequestMatchHandler(ghmock.GetReposGitTreesByOwnerByRepoByTreeSha, ghAlwaysWrite(t, &gh.Tree{
			SHA:       gh.Ptr("deadbeef"),
			Truncated: gh.Ptr(false),
			Entries: []*gh.TreeEntry{
				treeEntry("README.md", []byte("# Hello, World!")),
				treeEntry("dashboard.json", helper.LoadFile("testdata/all-panels.json")),
				treeEntry("subdir/dashboard2.yaml", helper.LoadFile("testdata/text-options.json")),
			},
		})),
		ghmock.WithRequestMatchHandler(
			ghmock.GetReposContentsByOwnerByRepoByPath,
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				pathRegex := regexp.MustCompile(`/repos/[^/]+/[^/]+/contents/(.*)`)
				matches := pathRegex.FindStringSubmatch(r.URL.Path)
				require.NotNil(t, matches, "no match for contents?")
				path := matches[1]

				var err error
				switch path {
				case "README.md":
					_, err = w.Write(ghmock.MustMarshal(repoContent("README.md", []byte("# Hello, World"))))
				case "dashboard.json":
					_, err = w.Write(ghmock.MustMarshal(repoContent("dashboard.json", helper.LoadFile("testdata/all-panels.json"))))
				case "subdir/dashboard2.yaml":
					_, err = w.Write(ghmock.MustMarshal(repoContent("subdir/dashboard2.yaml", helper.LoadFile("testdata/text-options.json"))))
				default:
					t.Fatalf("got unexpected path: %s", path)
				}
				require.NoError(t, err)
			}),
		),
	)

	_, err := helper.Repositories.Resource.Update(ctx,
		helper.LoadYAMLOrJSONFile("testdata/github-example.json"),
		metav1.UpdateOptions{},
	)
	require.NoError(t, err)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		list, err := helper.Jobs.Resource.List(ctx, metav1.ListOptions{})
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

		repo, err := helper.Repositories.Resource.Get(ctx, "github-example", metav1.GetOptions{})
		if assert.NoError(collect, err) {
			assert.Equal(collect, true, mustNested(repo.Object, "status", "health", "healthy"))
			assert.Equal(collect, "success", mustNestedString(repo.Object, "status", "sync", "state"))
		}
	}, time.Second*5, time.Millisecond*20)

	// By now, we should have synced, meaning we have data to read in the local Grafana instance!

	found, err := helper.Dashboards.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "can list values")

	names := []string{}
	for _, v := range found.Items {
		names = append(names, v.GetName())
	}
	require.Contains(t, names, "n1jR8vnnz", "should contain dashboard.json's contents")
	require.Contains(t, names, "WZ7AhQiVz", "should contain dashboard2.yaml's contents")
}

func TestIntegrationProvisioning_SafePathUsages(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	_, err := helper.Repositories.Resource.Update(ctx,
		helper.LoadYAMLOrJSONFile("testdata/local-devenv.json"),
		metav1.UpdateOptions{},
	)
	require.NoError(t, err)

	const repo = "local-devenv"
	result := helper.REST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("files", "all-panels.json").
		Body(helper.LoadFile("testdata/all-panels.json")).
		Do(ctx)
	require.NoError(t, result.Error(), "expecting to be able to create file")

	result = helper.REST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("files", "test", "..", "..", "all-panels.json").
		Body(helper.LoadFile("testdata/all-panels.json")).
		Do(ctx)
	require.Error(t, result.Error(), "invalid path should return error")

	_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "all-panels.json")
	require.NoError(t, err, "valid path should be fine")

	_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "../../all-panels.json")
	require.Error(t, err, "invalid path should not be fine")
}

func TestIntegrationProvisioning_ImportAllPanelsFromLocalRepository(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	const repo = "local-tmp"
	// Create the repository.
	repoPath := path.Join(helper.ProvisioningPath, repo, randomAsciiStr(10))
	err := os.MkdirAll(repoPath, 0700)
	require.NoError(t, err, "should be able to create repo path")
	localTmp := helper.LoadYAMLOrJSONFile("testdata/local-tmp.json")
	require.NoError(t, unstructured.SetNestedField(localTmp.Object, repoPath, "spec", "local", "path"))

	_, err = helper.Repositories.Resource.Create(ctx, localTmp, metav1.CreateOptions{})
	require.NoError(t, err)

	err = os.WriteFile(path.Join(repoPath, "all-panels.json"), helper.LoadFile("testdata/all-panels.json"), 0600)
	require.NoError(t, err, "expecting to be able to create file")

	// Make sure the repo can see the file
	_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "all-panels.json")
	require.NoError(t, err, "valid path should be fine")

	// But the dashboard shouldn't exist yet
	const allPanels = "n1jR8vnnz"
	_, err = helper.Dashboards.Resource.Get(ctx, allPanels, metav1.GetOptions{})
	require.Error(t, err, "no all-panels dashboard should exist")

	// Now, we import it, such that it may exist
	result := helper.REST.Post().
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
		job, err := helper.Jobs.Resource.Get(ctx, job, metav1.GetOptions{})
		require.NoError(t, err)

		state, _, err := unstructured.NestedString(job.Object, "status", "state")
		require.NoError(t, err)
		if provisioning.JobState(state).Finished() {
			break
		}
	}

	found, err := helper.Dashboards.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "can list values")

	names := []string{}
	for _, v := range found.Items {
		names = append(names, v.GetName())
	}
	require.Contains(t, names, allPanels, "all-panels dashboard should now exist")
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

func treeEntry(fpath string, content []byte) *gh.TreeEntry {
	sha := sha256.Sum256(content)
	typ := "blob"
	mode := "100644"
	if strings.HasSuffix(fpath, "/") {
		typ = "tree"
		mode = "040000"
	}

	return &gh.TreeEntry{
		SHA:     gh.Ptr(hex.EncodeToString(sha[:])),
		Path:    &fpath,
		Size:    gh.Ptr(len(content)),
		Type:    &typ,
		Mode:    &mode,
		Content: gh.Ptr(string(content)),
	}
}

func repoContent(fpath string, content []byte) *gh.RepositoryContent {
	sha := sha256.Sum256(content)
	typ := "blob"
	if strings.HasSuffix(fpath, "/") {
		typ = "tree"
	}

	return &gh.RepositoryContent{
		SHA:     gh.Ptr(hex.EncodeToString(sha[:])),
		Name:    gh.Ptr(path.Base(fpath)),
		Path:    &fpath,
		Size:    gh.Ptr(len(content)),
		Type:    &typ,
		Content: gh.Ptr(string(content)),
	}
}

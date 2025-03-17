package provisioning

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"text/template"
	"time"

	gh "github.com/google/go-github/v69/github"
	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	folder "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/apiserver"
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
	AdminREST    *rest.RESTClient
	ViewerREST   *rest.RESTClient
}

func (h *provisioningTestHelper) AwaitJobSuccess(t *testing.T, ctx context.Context, jobName string) {
	t.Helper()
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		job, err := h.Jobs.Resource.Get(ctx, jobName, metav1.GetOptions{})
		if assert.NoError(collect, err) {
			state, _, err := unstructured.NestedString(job.Object, "status", "state")

			assert.NoError(collect, err)
			require.NotEqual(t, string(provisioning.JobStateError), state, "job failed: %v", job.Object) // use t here: fail fast on errors.
			assert.Equal(collect, string(provisioning.JobStateSuccess), state)                           // use collect here: continue to check if the job is working on syncing.
		}
	}, time.Second*5, time.Millisecond*20)
}

func (h *provisioningTestHelper) AwaitJobs(t *testing.T, repoName string) {
	t.Helper()
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		list, err := h.Jobs.Resource.List(context.Background(), metav1.ListOptions{})
		if assert.NoError(collect, err) {
			for _, elem := range list.Items {
				state := mustNestedString(elem.Object, "status", "state")
				if elem.GetLabels()["repository"] == repoName {
					if state == string(provisioning.JobStateSuccess) {
						continue // doesn't matter
					}
					require.NotEqual(t, provisioning.JobStateError, state, "no jobs may error, but %s did", elem.GetName())
					collect.Errorf("there are still remaining github-example jobs: %v", elem)
					return
				}
			}
		}
	}, time.Second*5, time.Millisecond*20)
}

// RenderObject reads the filePath and renders it as a template with the given values.
// The template is expected to be a YAML or JSON file.
//
// The values object is mutated to also include the helper property as `h`.
func (h *provisioningTestHelper) RenderObject(t *testing.T, filePath string, values map[string]any) *unstructured.Unstructured {
	t.Helper()
	file := h.LoadFile(filePath)

	if values == nil {
		values = make(map[string]any)
	}
	values["h"] = h

	tmpl, err := template.New(filePath).Parse(string(file))
	require.NoError(t, err, "failed to parse template")

	var buf strings.Builder
	err = tmpl.Execute(&buf, values)
	require.NoError(t, err, "failed to execute template")

	return h.LoadYAMLOrJSON(buf.String())
}

// CopyToProvisioningPath copies a file to the provisioning path.
// The from path is relative to test file's directory.
func (h *provisioningTestHelper) CopyToProvisioningPath(t *testing.T, from, to string) {
	file := h.LoadFile(from)
	err := os.WriteFile(path.Join(h.ProvisioningPath, to), file, 0600)
	require.NoError(t, err, "failed to write file to provisioning path")
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
	apiserver.ClearRestConfig()

	provisioningPath := t.TempDir()
	opts := testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		EnableFeatureToggles: []string{
			featuremgmt.FlagProvisioning,
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagNestedFolders,
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

	viewerClient := helper.Org1.Viewer.RESTClient(t, &schema.GroupVersion{
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
		AdminREST:    restClient,
		ViewerREST:   viewerClient,
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

func ghHandleTree(t *testing.T, refs map[string][]*gh.TreeEntry) http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sha := r.URL.Path[strings.LastIndex(r.URL.Path, "/")+1:]
		require.NotEmpty(t, sha, "sha path parameter was missing?")

		entries := refs[sha]
		require.NotNil(t, entries, "no entries for sha %s", sha)

		tree := &gh.Tree{
			SHA:       gh.Ptr(sha),
			Truncated: gh.Ptr(false),
			Entries:   entries,
		}

		_, err := w.Write(ghmock.MustMarshal(tree))
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

	inputFiles := []string{
		"testdata/github-readonly.json.tmpl",
		"testdata/local-readonly.json.tmpl",
	}

	for _, inputFilePath := range inputFiles {
		t.Run(inputFilePath, func(t *testing.T) {
			input := helper.RenderObject(t, inputFilePath, nil)

			_, err := helper.Repositories.Resource.Create(ctx, input, createOptions)
			require.NoError(t, err, "failed to create resource")

			name := mustNestedString(input.Object, "metadata", "name")
			output, err := helper.Repositories.Resource.Get(ctx, name, metav1.GetOptions{})
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

			// A viewer should not be able to see the same thing
			var statusCode int
			rsp := helper.ViewerREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(name).
				Do(context.Background())
			require.Error(t, rsp.Error())
			rsp.StatusCode(&statusCode)
			require.Equal(t, http.StatusForbidden, statusCode)

			// Viewer can see file listing
			rsp = helper.ViewerREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(name).
				Suffix("files/").
				Do(context.Background())
			require.NoError(t, rsp.Error())
		})
	}

	// Viewer can see settings listing
	settings := &provisioning.RepositoryViewList{}
	rsp := helper.ViewerREST.Get().
		Namespace("default").
		Suffix("settings").
		Do(context.Background())
	require.NoError(t, rsp.Error())
	err := rsp.Into(settings)
	require.NoError(t, err)
	require.Len(t, settings.Items, len(inputFiles))
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
		ghmock.WithRequestMatchHandler(ghmock.GetReposGitTreesByOwnerByRepoByTreeSha,
			ghHandleTree(t, map[string][]*gh.TreeEntry{
				"deadbeef": {
					treeEntryDir("grafana", "subtree"),
				},
				"subtree": {
					treeEntry("dashboard.json", helper.LoadFile("testdata/all-panels.json")),
					treeEntryDir("subdir", "subtree2"),
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
				case "grafana/dashboard.json":
					_, err = w.Write(ghmock.MustMarshal(repoContent(path, helper.LoadFile("testdata/all-panels.json"))))
				case "grafana/subdir/dashboard2.yaml":
					_, err = w.Write(ghmock.MustMarshal(repoContent(path, helper.LoadFile("testdata/text-options.json"))))
				default:
					t.Fatalf("got unexpected path: %s", path)
				}
				require.NoError(t, err)
			}),
		),
	)

	const repo = "github-create-test"
	_, err := helper.Repositories.Resource.Update(ctx,
		helper.RenderObject(t, "testdata/github-readonly.json.tmpl", map[string]any{
			"Name":        repo,
			"SyncEnabled": true,
			"SyncTarget":  "instance",
			"Path":        "grafana/",
		}),
		metav1.UpdateOptions{},
	)
	require.NoError(t, err)

	result := helper.AdminREST.Post().
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

	helper.AwaitJobSuccess(t, ctx, job)

	// By now, we should have synced, meaning we have data to read in the local Grafana instance!

	found, err := helper.Dashboards.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "can list values")

	names := []string{}
	for _, v := range found.Items {
		names = append(names, v.GetName())
	}
	assert.Contains(t, names, "n1jR8vnnz", "should contain dashboard.json's contents")
	assert.Contains(t, names, "WZ7AhQiVz", "should contain dashboard2.yaml's contents")
}

func TestIntegrationProvisioning_SafePathUsages(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	const repo = "local-safe-path-usages"
	// Set up the repository.
	localTmp := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{"Name": repo})
	_, err := helper.Repositories.Resource.Create(ctx, localTmp, metav1.CreateOptions{})
	require.NoError(t, err)

	// Write a file
	result := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("files", "all-panels.json").
		Body(helper.LoadFile("testdata/all-panels.json")).
		Do(ctx)
	require.NoError(t, result.Error(), "expecting to be able to create file")

	// Write a file with a bad path
	result = helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("files", "test", "..", "..", "all-panels.json").
		Body(helper.LoadFile("testdata/all-panels.json")).
		Do(ctx)
	require.Error(t, result.Error(), "invalid path should return error")

	// Read a file
	_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "all-panels.json")
	require.NoError(t, err, "valid path should be fine")

	// Read a file with a bad path
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
	// Set up the repository and the file to import.
	helper.CopyToProvisioningPath(t, "testdata/all-panels.json", "all-panels.json")

	localTmp := helper.RenderObject(t, "testdata/local-readonly.json.tmpl", map[string]any{
		"Name":        repo,
		"SyncEnabled": true,
	})
	_, err := helper.Repositories.Resource.Create(ctx, localTmp, metav1.CreateOptions{})
	require.NoError(t, err)

	// Make sure the repo can see the file
	_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "all-panels.json")
	require.NoError(t, err, "valid path should be fine")

	// But the dashboard shouldn't exist yet
	const allPanels = "n1jR8vnnz"
	_, err = helper.Dashboards.Resource.Get(ctx, allPanels, metav1.GetOptions{})
	require.Error(t, err, "no all-panels dashboard should exist")

	// Now, we import it, such that it may exist
	result := helper.AdminREST.Post().
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
	helper.AwaitJobSuccess(t, ctx, job)

	found, err := helper.Dashboards.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "can list values")

	names := []string{}
	for _, v := range found.Items {
		names = append(names, v.GetName())
	}
	require.Contains(t, names, allPanels, "all-panels dashboard should now exist")
}

func TestProvisioning_ExportUnifiedToRepository(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	// Set up dashboards first, then the repository, and finally export.
	dashboard := helper.LoadYAMLOrJSONFile("exportunifiedtorepository/root_dashboard.json")
	_, err := helper.Dashboards.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create prerequisite dashboard")

	// Now for the repository.
	const repo = "local-repository"
	createBody := helper.RenderObject(t, "exportunifiedtorepository/repository.json.tmpl", map[string]any{"Name": repo})
	_, err = helper.Repositories.Resource.Create(ctx, createBody, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create repository")

	// Now export...
	result := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("export").
		Body(asJSON(&provisioning.ExportJobOptions{
			Folder:     "",   // export entire instance
			Prefix:     "",   // no prefix necessary for testing
			Identifier: true, // doesn't _really_ matter, but handy for debugging.
		})).
		Do(ctx)
	require.NoError(t, result.Error())

	// And time to assert.
	helper.AwaitJobs(t, repo)

	fpath := filepath.Join(helper.ProvisioningPath, slugify.Slugify(mustNestedString(dashboard.Object, "spec", "title"))+".json")
	_, err = os.Stat(fpath)
	require.NoError(t, err, "exported file was not created at path %s", fpath)
}

func mustNestedString(obj map[string]interface{}, fields ...string) string {
	v, _, err := unstructured.NestedString(obj, fields...)
	if err != nil {
		panic(err)
	}
	return v
}

func asJSON(obj any) []byte {
	jj, _ := json.Marshal(obj)
	return jj
}

func treeEntryDir(dirName string, sha string) *gh.TreeEntry {
	return &gh.TreeEntry{
		SHA:  gh.Ptr(sha),
		Path: gh.Ptr(dirName),
		Type: gh.Ptr("tree"),
		Mode: gh.Ptr("040000"),
	}
}

func treeEntry(fpath string, content []byte) *gh.TreeEntry {
	sha := sha256.Sum256(content)

	return &gh.TreeEntry{
		SHA:     gh.Ptr(hex.EncodeToString(sha[:])),
		Path:    gh.Ptr(fpath),
		Size:    gh.Ptr(len(content)),
		Type:    gh.Ptr("blob"),
		Mode:    gh.Ptr("100644"),
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

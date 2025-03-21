package provisioning

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"path"
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
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
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
	HistoricJobs *apis.K8sResourceClient
	Folders      *apis.K8sResourceClient
	Dashboards   *apis.K8sResourceClient
	AdminREST    *rest.RESTClient
	ViewerREST   *rest.RESTClient
}

func (h *provisioningTestHelper) AwaitJobSuccess(t *testing.T, ctx context.Context, jobName string) {
	t.Helper()
	if !assert.EventuallyWithT(t, func(collect *assert.CollectT) {
		jobs, err := h.HistoricJobs.Resource.List(ctx, metav1.ListOptions{
			LabelSelector: jobs.LabelJobOriginalName + "=" + jobName,
		})
		if assert.NoError(collect, err) && assert.NotEmpty(collect, jobs.Items, "no historic jobs found yet") {
			for _, job := range jobs.Items {
				state := mustNestedString(job.Object, "status", "state")
				if state == "" {
					// The job hasn't gotten its state yet. We do two requests: one to insert the job, one to set the status.
					assert.Fail(collect, "job '%s' has no state yet", jobName)
				}

				// We can fail fast once the job is here: HistoricJobs are immutable.
				require.Equal(t, string(provisioning.JobStateSuccess), state, "historic job '%s' was not successful", jobName)
			}
		}
	}, time.Second*5, time.Millisecond*20) {
		// We also want to add the job details to the error when it fails.
		job, err := h.Jobs.Resource.Get(ctx, jobName, metav1.GetOptions{})
		if err != nil {
			t.Logf("failed to get job details for further help: %v", err)
		} else {
			t.Logf("job details: %+v", job.Object)
		}
		t.FailNow()
	}
}

func (h *provisioningTestHelper) AwaitJobs(t *testing.T, repoName string) {
	t.Helper()

	// First, we wait for all jobs for the repository to disappear (i.e. complete/fail).
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		list, err := h.Jobs.Resource.List(context.Background(), metav1.ListOptions{})
		if assert.NoError(collect, err, "failed to list active jobs") {
			for _, elem := range list.Items {
				// TODO: Use the spec field of the job.
				if elem.GetLabels()["repository"] == repoName {
					collect.Errorf("there are still remaining jobs for %s: %+v", repoName, elem)
					return
				}
			}
		}
	}, time.Second*5, time.Millisecond*20)

	// Then, as all jobs are now historic jobs, we make sure they are successful.
	list, err := h.HistoricJobs.Resource.List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err, "failed to list historic jobs")

	for _, elem := range list.Items {
		// TODO: Use the spec field of the job.
		if elem.GetLabels()["repository"] == repoName {
			require.Equal(t, string(provisioning.JobStateSuccess), mustNestedString(elem.Object, "status", "state"), "job %s failed: %+v", elem.GetName(), elem.Object)
		}
	}
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
	historicJobs := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       provisioning.HistoricJobResourceInfo.GroupVersionResource(),
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
		HistoricJobs: historicJobs,
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

func unstructuredToRepository(t *testing.T, obj *unstructured.Unstructured) *provisioning.Repository {
	bytes, err := obj.MarshalJSON()
	require.NoError(t, err)

	repo := &provisioning.Repository{}
	err = json.Unmarshal(bytes, repo)
	require.NoError(t, err)

	return repo
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

package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"testing"
	"text/template"
	"time"

	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashboardsV2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashboardsV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	folder "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
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

	Repositories       *apis.K8sResourceClient
	Jobs               *apis.K8sResourceClient
	Folders            *apis.K8sResourceClient
	DashboardsV0       *apis.K8sResourceClient
	DashboardsV1       *apis.K8sResourceClient
	DashboardsV2alpha1 *apis.K8sResourceClient
	DashboardsV2beta1  *apis.K8sResourceClient
	AdminREST          *rest.RESTClient
	EditorREST         *rest.RESTClient
	ViewerREST         *rest.RESTClient
}

func (h *provisioningTestHelper) SyncAndWait(t *testing.T, repo string, options *provisioning.SyncJobOptions) {
	t.Helper()

	if options == nil {
		options = &provisioning.SyncJobOptions{}
	}
	body := asJSON(&provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   options,
	})

	result := h.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("jobs").
		Body(body).
		SetHeader("Content-Type", "application/json").
		Do(t.Context())

	if apierrors.IsAlreadyExists(result.Error()) {
		// Wait for all jobs to finish as we don't have the name.
		h.AwaitJobs(t, repo)
		return
	}

	obj, err := result.Get()
	require.NoError(t, err, "expecting to be able to sync repository")

	unstruct, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok, "expecting unstructured object, but got %T", obj)

	name := unstruct.GetName()
	require.NotEmpty(t, name, "expecting name to be set")
	h.AwaitJobSuccess(t, t.Context(), unstruct)
}

func (h *provisioningTestHelper) AwaitJobSuccess(t *testing.T, ctx context.Context, job *unstructured.Unstructured) {
	t.Helper()

	repo := job.GetLabels()[jobs.LabelRepository]
	require.NotEmpty(t, repo)
	if !assert.EventuallyWithT(t, func(collect *assert.CollectT) {
		result, err := h.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{},
			"jobs", string(job.GetUID()))

		if apierrors.IsNotFound(err) {
			assert.Fail(collect, "job '%s' not found yet yet", job.GetName())
			return // continue trying
		}

		// Can fail fast here -- the jobs are immutable
		require.NoError(t, err)
		require.NotNil(t, result)

		errors := mustNestedStringSlice(result.Object, "status", "errors")
		require.Empty(t, errors, "historic job '%s' has errors: %v", job.GetName(), errors)
		state := mustNestedString(result.Object, "status", "state")
		require.Equal(t, string(provisioning.JobStateSuccess), state,
			"historic job '%s' was not successful", job.GetName())
	}, time.Second*10, time.Millisecond*25) {
		// We also want to add the job details to the error when it fails.
		job, err := h.Jobs.Resource.Get(ctx, job.GetName(), metav1.GetOptions{})
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
				repo, _, err := unstructured.NestedString(elem.Object, "spec", "repository")
				require.NoError(t, err)
				if repo == repoName {
					collect.Errorf("there are still remaining jobs for %s: %+v", repoName, elem)
					return
				}
			}
		}
	}, time.Second*10, time.Millisecond*25, "job queue must be empty")

	// Then, as all jobs are now historic jobs, we make sure they are successful.
	result, err := h.Repositories.Resource.Get(context.Background(), repoName, metav1.GetOptions{}, "jobs")
	require.NoError(t, err, "failed to list historic jobs")

	list, err := result.ToList()
	require.NoError(t, err, "results should be a list")
	require.NotEmpty(t, list.Items, "expect at least one job")

	for _, elem := range list.Items {
		require.Equal(t, repoName, elem.GetLabels()[jobs.LabelRepository], "should have repo label")

		state := mustNestedString(elem.Object, "status", "state")
		require.Equal(t, string(provisioning.JobStateSuccess), state, "job %s failed: %+v", elem.GetName(), elem.Object)
	}
}

// AwaitJobsWithStates waits for all jobs for a repository to complete and accepts multiple valid end states
func (h *provisioningTestHelper) AwaitJobsWithStates(t *testing.T, repoName string, acceptedStates []string) {
	t.Helper()

	// First, we wait for all jobs for the repository to disappear (i.e. complete/fail).
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		list, err := h.Jobs.Resource.List(context.Background(), metav1.ListOptions{})
		if assert.NoError(collect, err, "failed to list active jobs") {
			for _, elem := range list.Items {
				repo, _, err := unstructured.NestedString(elem.Object, "spec", "repository")
				require.NoError(t, err)
				if repo == repoName {
					collect.Errorf("there are still remaining jobs for %s: %+v", repoName, elem)
					return
				}
			}
		}
	}, time.Second*10, time.Millisecond*25, "job queue must be empty")

	// Then, as all jobs are now historic jobs, we make sure they are in an accepted state.
	result, err := h.Repositories.Resource.Get(context.Background(), repoName, metav1.GetOptions{}, "jobs")
	require.NoError(t, err, "failed to list historic jobs")

	list, err := result.ToList()
	require.NoError(t, err, "results should be a list")
	require.NotEmpty(t, list.Items, "expect at least one job")

	for _, elem := range list.Items {
		require.Equal(t, repoName, elem.GetLabels()[jobs.LabelRepository], "should have repo label")

		state := mustNestedString(elem.Object, "status", "state")

		// Check if state is in accepted states
		found := false
		for _, acceptedState := range acceptedStates {
			if state == acceptedState {
				found = true
				break
			}
		}
		require.True(t, found, "job %s completed with unexpected state %s (expected one of %v): %+v", elem.GetName(), state, acceptedStates, elem.Object)
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
	fullPath := path.Join(h.ProvisioningPath, to)
	err := os.MkdirAll(path.Dir(fullPath), 0750)
	require.NoError(t, err, "failed to create directories for provisioning path")

	file := h.LoadFile(from)
	err = os.WriteFile(fullPath, file, 0600)
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

func useAppPlatformSecrets(opts *testinfra.GrafanaOpts) {
	opts.EnableFeatureToggles = append(opts.EnableFeatureToggles,
		featuremgmt.FlagProvisioningSecretsService,
		featuremgmt.FlagSecretsManagementAppPlatform,
	)
}

func runGrafana(t *testing.T, options ...grafanaOption) *provisioningTestHelper {
	provisioningPath := t.TempDir()
	opts := testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		EnableFeatureToggles: []string{
			featuremgmt.FlagProvisioning,
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

	// FIXME: keeping this line here to keep the dependency around until we have tests which use this again.
	helper.GetEnv().GitHubFactory.Client = ghmock.NewMockedHTTPClient()

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
	dashboardsV0 := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       dashboardV0.DashboardResourceInfo.GroupVersionResource(),
	})
	dashboardsV1 := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       dashboardV1.DashboardResourceInfo.GroupVersionResource(),
	})
	dashboardsV2alpha1 := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       dashboardsV2alpha1.DashboardResourceInfo.GroupVersionResource(),
	})
	dashboardsV2beta1 := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       dashboardsV2beta1.DashboardResourceInfo.GroupVersionResource(),
	})

	// Repo client, but less guard rails. Useful for subresources. We'll need this later...
	gv := &schema.GroupVersion{Group: "provisioning.grafana.app", Version: "v0alpha1"}
	adminClient := helper.Org1.Admin.RESTClient(t, gv)
	editorClient := helper.Org1.Editor.RESTClient(t, gv)
	viewerClient := helper.Org1.Viewer.RESTClient(t, gv)

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

	require.NoError(t, deleteAll(dashboardsV1), "deleting all dashboards") // v0+v1+v2
	require.NoError(t, deleteAll(folders), "deleting all folders")
	require.NoError(t, deleteAll(repositories), "deleting all repositories")

	return &provisioningTestHelper{
		ProvisioningPath: provisioningPath,
		K8sTestHelper:    helper,

		Repositories:       repositories,
		AdminREST:          adminClient,
		EditorREST:         editorClient,
		ViewerREST:         viewerClient,
		Jobs:               jobs,
		Folders:            folders,
		DashboardsV0:       dashboardsV0,
		DashboardsV1:       dashboardsV1,
		DashboardsV2alpha1: dashboardsV2alpha1,
		DashboardsV2beta1:  dashboardsV2beta1,
	}
}

func mustNestedString(obj map[string]interface{}, fields ...string) string {
	v, _, err := unstructured.NestedString(obj, fields...)
	if err != nil {
		panic(err)
	}
	return v
}

func mustNestedStringSlice(obj map[string]interface{}, fields ...string) []string {
	v, _, err := unstructured.NestedStringSlice(obj, fields...)
	if err != nil {
		panic(err)
	}
	return v
}

func asJSON(obj any) []byte {
	jj, _ := json.Marshal(obj)
	return jj
}

func unstructuredToRepository(t *testing.T, obj *unstructured.Unstructured) *provisioning.Repository {
	bytes, err := obj.MarshalJSON()
	require.NoError(t, err)

	repo := &provisioning.Repository{}
	err = json.Unmarshal(bytes, repo)
	require.NoError(t, err)

	return repo
}

// postFilesRequest performs a direct HTTP POST request to the files API.
// This bypasses Kubernetes REST client limitations with '/' characters in subresource names.
type filesPostOptions struct {
	targetPath   string // The target file/directory path
	originalPath string // Source path for move operations (optional)
	message      string // Commit message (optional)
	body         string // Request body content (optional)
	ref          string // Git ref/branch (optional)
}

func (h *provisioningTestHelper) postFilesRequest(t *testing.T, repo string, opts filesPostOptions) *http.Response {
	addr := h.GetEnv().Server.HTTPServer.Listener.Addr().String()
	baseUrl := fmt.Sprintf("http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/%s",
		addr, repo, opts.targetPath)

	// Build the URL with proper query parameter encoding
	parsedUrl, err := url.Parse(baseUrl)
	require.NoError(t, err)
	params := parsedUrl.Query()

	if opts.originalPath != "" {
		params.Set("originalPath", opts.originalPath)
	}
	if opts.message != "" {
		params.Set("message", opts.message)
	}
	if opts.ref != "" {
		params.Set("ref", opts.ref)
	}
	parsedUrl.RawQuery = params.Encode()

	req, err := http.NewRequest(http.MethodPost, parsedUrl.String(), strings.NewReader(opts.body))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)

	return resp
}

// printFileTree prints the directory structure as a tree for debugging purposes
func printFileTree(t *testing.T, rootPath string) {
	t.Helper()
	t.Logf("File tree for %s:", rootPath)

	err := filepath.WalkDir(rootPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		relPath, err := filepath.Rel(rootPath, path)
		if err != nil {
			return err
		}

		if relPath == "." {
			return nil
		}

		depth := strings.Count(relPath, string(filepath.Separator))
		indent := strings.Repeat("  ", depth)

		if d.IsDir() {
			t.Logf("%s├── %s/", indent, d.Name())
		} else {
			info, err := d.Info()
			if err != nil {
				t.Logf("%s├── %s (error reading info)", indent, d.Name())
			} else {
				t.Logf("%s├── %s (%d bytes)", indent, d.Name(), info.Size())
			}
		}

		return nil
	})
	if err != nil {
		t.Logf("Error walking directory: %v", err)
	}
}

// Helper function to count files in a directory recursively
func countFilesInDir(rootPath string) (int, error) {
	count := 0
	err := filepath.WalkDir(rootPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			count++
		}
		return nil
	})
	return count, err
}

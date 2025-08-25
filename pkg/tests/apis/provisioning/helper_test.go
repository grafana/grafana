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

func (h *provisioningTestHelper) TriggerJobAndWaitForSuccess(t *testing.T, repo string, spec provisioning.JobSpec) {
	t.Helper()

	body := asJSON(spec)
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

func (h *provisioningTestHelper) TriggerJobAndWaitForComplete(t *testing.T, repo string, spec provisioning.JobSpec) *unstructured.Unstructured {
	t.Helper()

	body := asJSON(spec)
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
		t.Errorf("repository %s already has a job running, but we expected a new one to be created", repo)
		t.FailNow()

		return nil
	}

	obj, err := result.Get()
	require.NoError(t, err, "expecting to be able to sync repository")

	unstruct, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok, "expecting unstructured object, but got %T", obj)

	name := unstruct.GetName()
	require.NotEmpty(t, name, "expecting name to be set")

	return h.AwaitJob(t, t.Context(), unstruct)
}

func (h *provisioningTestHelper) AwaitJobSuccess(t *testing.T, ctx context.Context, job *unstructured.Unstructured) {
	t.Helper()
	job = h.AwaitJob(t, ctx, job)
	lastErrors := mustNestedStringSlice(job.Object, "status", "errors")
	lastState := mustNestedString(job.Object, "status", "state")

	repo := job.GetLabels()[jobs.LabelRepository]

	// Debug state if job failed
	if len(lastErrors) > 0 || lastState != string(provisioning.JobStateSuccess) {
		h.DebugState(t, repo, fmt.Sprintf("JOB FAILED: %s", job.GetName()))
	}

	require.Empty(t, lastErrors, "historic job '%s' has errors: %v", job.GetName(), lastErrors)
	require.Equal(t, string(provisioning.JobStateSuccess), lastState,
		"historic job '%s' was not successful", job.GetName())
}

func (h *provisioningTestHelper) AwaitJob(t *testing.T, ctx context.Context, job *unstructured.Unstructured) *unstructured.Unstructured {
	t.Helper()

	repo := job.GetLabels()[jobs.LabelRepository]
	require.NotEmpty(t, repo)

	var lastResult *unstructured.Unstructured
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		result, err := h.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{},
			"jobs", string(job.GetUID()))

		if !assert.False(collect, apierrors.IsNotFound(err)) {
			collect.Errorf("job '%s' not found, still waiting for it to complete", job.GetName())
			return
		}

		assert.NoError(collect, err, "failed to get job '%s' to be found", job.GetName())
		if err != nil {
			return
		}

		lastResult = result
	}, time.Second*10, time.Millisecond*25)
	require.NotNil(t, lastResult, "expected job result to be non-nil")

	return lastResult
}

func (h *provisioningTestHelper) AwaitJobs(t *testing.T, repoName string) {
	t.Helper()

	// First, we wait for all jobs for the repository to disappear (i.e. complete/fail).
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		list, err := h.Jobs.Resource.List(context.Background(), metav1.ListOptions{})
		if assert.NoError(collect, err, "failed to list active jobs") {
			for _, elem := range list.Items {
				repo, _, err := unstructured.NestedString(elem.Object, "spec", "repository")
				if !assert.NoError(collect, err, "failed to get repository from job spec") {
					return
				}

				if !assert.NotEqual(collect, repoName, repo, "there are still remaining jobs for %s: %+v", repoName, elem) {
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
				if !assert.NoError(collect, err, "failed to get repository from job spec") {
					return
				}

				if !assert.NotEqual(collect, repoName, repo, "there are still remaining jobs for %s: %+v", repoName, elem) {
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
	t.Logf("Copying file from '%s' to provisioning path '%s'", from, fullPath)
	err := os.MkdirAll(path.Dir(fullPath), 0750)
	require.NoError(t, err, "failed to create directories for provisioning path")

	file := h.LoadFile(from)
	err = os.WriteFile(fullPath, file, 0600)
	require.NoError(t, err, "failed to write file to provisioning path")
}

// DebugState logs the current state of filesystem, repository, and Grafana resources for debugging
func (h *provisioningTestHelper) DebugState(t *testing.T, repo string, label string) {
	t.Helper()
	t.Logf("=== DEBUG STATE: %s ===", label)

	ctx := context.Background()

	// Log filesystem contents using existing tree function
	printFileTree(t, h.ProvisioningPath)

	// Log all repositories first
	t.Logf("All repositories:")
	repos, err := h.Repositories.Resource.List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Logf("  ERROR listing repositories: %v", err)
	} else {
		t.Logf("  Total repositories: %d", len(repos.Items))
		for i, repository := range repos.Items {
			t.Logf("  Repository %d: name=%s", i+1, repository.GetName())
		}
	}

	// Log repository files for the specific repo
	t.Logf("Repository '%s' files:", repo)
	h.logRepositoryFiles(t, ctx, repo, "  ")

	// Log files for all other repositories too
	if repos != nil && len(repos.Items) > 1 {
		t.Logf("Files in other repositories:")
		for _, repository := range repos.Items {
			if repository.GetName() != repo {
				t.Logf("  Repository '%s' files:", repository.GetName())
				h.logRepositoryFiles(t, ctx, repository.GetName(), "    ")
			}
		}
	}

	// Log Grafana dashboards
	t.Logf("Grafana dashboards:")
	dashboards, err := h.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Logf("  ERROR listing dashboards: %v", err)
	} else {
		t.Logf("  Total dashboards: %d", len(dashboards.Items))
		for i, dashboard := range dashboards.Items {
			t.Logf("  Dashboard %d: name=%s, UID=%s", i+1, dashboard.GetName(), dashboard.GetUID())
		}
	}

	// Log Grafana folders
	t.Logf("Grafana folders:")
	folders, err := h.Folders.Resource.List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Logf("  ERROR listing folders: %v", err)
	} else {
		t.Logf("  Total folders: %d", len(folders.Items))
		for i, folder := range folders.Items {
			t.Logf("  Folder %d: name=%s", i+1, folder.GetName())
		}
	}

	t.Logf("=== END DEBUG STATE ===")
}

// logRepositoryFiles logs repository file structure using the files API
func (h *provisioningTestHelper) logRepositoryFiles(t *testing.T, ctx context.Context, repoName string, prefix string) {
	t.Helper()

	// Try to list files at root level
	files, err := h.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{}, "files")
	if err != nil {
		t.Logf("%sERROR getting repository files: %v", prefix, err)
		return
	}

	// The API returns a structured response, we need to extract the actual file data
	if files.Object != nil {
		h.logRepositoryObject(t, files.Object, prefix, "")
	} else {
		t.Logf("%s(empty repository)", prefix)
	}
}

// logRepositoryObject recursively logs repository file structure from API response
func (h *provisioningTestHelper) logRepositoryObject(t *testing.T, obj map[string]interface{}, prefix string, path string) {
	t.Helper()

	if obj == nil {
		return
	}

	// Skip metadata fields and focus on actual content
	for key, value := range obj {
		// Skip Kubernetes metadata fields
		if key == "kind" || key == "apiVersion" || key == "metadata" {
			continue
		}

		// Calculate new path for nested objects
		var newPath string
		if path != "" {
			newPath = path + "/" + key
		} else {
			newPath = key
		}

		switch v := value.(type) {
		case map[string]interface{}:
			t.Logf("%s├── %s/", prefix, key)
			h.logRepositoryObject(t, v, prefix+"  ", newPath)
		case []interface{}:
			// Handle lists (like items array)
			if key == "items" && len(v) > 0 {
				t.Logf("%s%d items:", prefix, len(v))
				for i, item := range v {
					if itemMap, ok := item.(map[string]interface{}); ok {
						// Try to get the actual file path from the item
						if pathVal, exists := itemMap["path"]; exists {
							t.Logf("%s├── %v", prefix, pathVal)
						} else {
							t.Logf("%s├── item %d:", prefix, i+1)
						}
						h.logRepositoryObject(t, itemMap, prefix+"  ", newPath)
					}
				}
			}
		default:
			// This could be file content or metadata
			// Skip common metadata fields that are not useful for debugging
			if key != "kind" && key != "apiVersion" && key != "path" && key != "size" && key != "hash" {
				t.Logf("%s├── %s: %v", prefix, key, value)
			}
		}
	}
}

// validateManagedDashboardsFolderMetadata validates the folder metadata
// of the managed dashboards.
// If folder is nested, folder annotations should not be empty.
// Also checks that the managerId property exists.
func (h *provisioningTestHelper) validateManagedDashboardsFolderMetadata(t *testing.T,
	ctx context.Context, repoName string, dashboards []unstructured.Unstructured) {
	t.Helper()

	// Check if folder is nested or not.
	// If not, folder annotations should be empty as we have an "instance" sync target
	for _, d := range dashboards {
		sourcePath, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/sourcePath")
		isNested := strings.Contains(sourcePath, "/")

		folder, found, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/folder")
		if isNested {
			require.True(t, found, "dashboard should have a folder annotation")
			require.NotEmpty(t, folder, "dashboard should be in a non-empty folder")
		} else {
			require.False(t, found, "dashboard should not have a folder annotation")
		}

		managerID, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/managerId")
		// require.Equal(t, repoName, managerID, "dashboard should be managed by gitsync repo")
		require.Equal(t, repoName, managerID, "dashboard should be managed by gitsync repo")
	}
}

type TestRepo struct {
	Name               string
	Target             string
	Path               string
	Values             map[string]any
	Copies             map[string]string
	ExpectedDashboards int
	ExpectedFolders    int
	SkipSync           bool
}

func (h *provisioningTestHelper) CreateRepo(t *testing.T, repo TestRepo) {
	if repo.Target == "" {
		repo.Target = "instance"
	}

	// Use custom path if provided, otherwise use default provisioning path
	repoPath := h.ProvisioningPath
	if repo.Path != "" {
		repoPath = repo.Path
		// Ensure the directory exists
		err := os.MkdirAll(repoPath, 0750)
		require.NoError(t, err, "should be able to create repository path")
	}

	templateVars := map[string]any{
		"Name":        repo.Name,
		"SyncEnabled": !repo.SkipSync,
		"SyncTarget":  repo.Target,
	}
	if repo.Path != "" {
		templateVars["Path"] = repoPath
	}

	localTmp := h.RenderObject(t, "testdata/local-write.json.tmpl", templateVars)

	_, err := h.Repositories.Resource.Create(t.Context(), localTmp, metav1.CreateOptions{})
	require.NoError(t, err)

	for from, to := range repo.Copies {
		if repo.Path != "" {
			// Copy to custom path
			fullPath := path.Join(repoPath, to)
			err := os.MkdirAll(path.Dir(fullPath), 0750)
			require.NoError(t, err, "failed to create directories for custom path")
			file := h.LoadFile(from)
			err = os.WriteFile(fullPath, file, 0600)
			require.NoError(t, err, "failed to write file to custom path")
		} else {
			h.CopyToProvisioningPath(t, from, to)
		}
	}

	if !repo.SkipSync {
		// Trigger and wait for initial sync to populate resources
		h.SyncAndWait(t, repo.Name, nil)
		h.DebugState(t, repo.Name, "AFTER INITIAL SYNC")
	} else {
		h.DebugState(t, repo.Name, "AFTER REPO CREATION")
	}

	// Verify initial state
	dashboards, err := h.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err)
	require.Equal(t, repo.ExpectedDashboards, len(dashboards.Items), "should the expected dashboards after sync")

	folders, err := h.Folders.Resource.List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err)
	require.Equal(t, repo.ExpectedFolders, len(folders.Items), "should have the expected folders after sync")
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

// CleanupAllRepos deletes all repositories and waits for them to be fully removed
func (h *provisioningTestHelper) CleanupAllRepos(t *testing.T) {
	t.Helper()
	ctx := context.Background()

	// First, get all repositories that exist
	list, err := h.Repositories.Resource.List(ctx, metav1.ListOptions{})
	if err != nil || len(list.Items) == 0 {
		return // Nothing to clean up
	}

	// Wait for any active jobs to complete before deleting repositories
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		activeJobs, err := h.Jobs.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(collect, err, "failed to list active jobs") {
			return
		}
		assert.Equal(collect, 0, len(activeJobs.Items), "all active jobs should complete before cleanup")
	}, time.Second*20, time.Millisecond*100, "active jobs should complete before cleanup")

	// Now delete all repositories with retries
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		list, err := h.Repositories.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(collect, err) {
			return
		}

		for _, repo := range list.Items {
			err := h.Repositories.Resource.Delete(ctx, repo.GetName(), metav1.DeleteOptions{})
			// Don't fail if already deleted (404 is OK)
			if err != nil {
				assert.True(collect, apierrors.IsNotFound(err), "Should be able to delete repository %s (or it should already be deleted)", repo.GetName())
			}
		}
	}, time.Second*10, time.Millisecond*100, "should be able to delete all repositories")

	// Then wait for repositories to be fully deleted to ensure clean state
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		list, err := h.Repositories.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		assert.Equal(collect, 0, len(list.Items), "repositories should be cleaned up")
	}, time.Second*15, time.Millisecond*100, "repositories should be cleaned up between subtests")
}

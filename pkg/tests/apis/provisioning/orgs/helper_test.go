package orgs

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

var env = common.NewSharedEnv(
	common.WithoutProvisioningFolderMetadata,
	func(opts *testinfra.GrafanaOpts) {
		opts.SecretsManagerEnableDBMigrations = true
	},
	common.WithoutExportFeatureFlag,
)

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	return common.SharedHelper(t, env)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

// OrgHelper wraps ProvisioningTestHelper with org-specific context
type OrgHelper struct {
	helper    *common.ProvisioningTestHelper
	user      apis.User
	namespace string
}

// GetOrgHelper returns a helper configured for a specific organization
func GetOrgHelper(helper *common.ProvisioningTestHelper, orgUsers apis.OrgUsers) *OrgHelper {
	return &OrgHelper{
		helper:    helper,
		user:      orgUsers.Admin,
		namespace: helper.Namespacer(orgUsers.OrgID),
	}
}

// CreateRepo creates a repository in this organization's namespace
func (h *OrgHelper) CreateRepo(t *testing.T, repo common.TestRepo) {
	t.Helper()

	if repo.Target == "" {
		repo.Target = "instance"
	}

	// Use custom path if provided, otherwise use default provisioning path
	repoPath := h.helper.ProvisioningPath
	if repo.Path != "" {
		repoPath = repo.Path
		// Ensure the directory exists
		err := os.MkdirAll(repoPath, 0o750)
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
	// Add custom values from TestRepo
	for key, value := range repo.Values {
		templateVars[key] = value
	}

	var thisFile string
	if _, file, _, ok := runtime.Caller(0); ok {
		thisFile = file
	}
	tmpl := filepath.Join(filepath.Dir(thisFile), "../testdata/local-write.json.tmpl")
	if repo.Template != "" {
		tmpl = repo.Template
	}
	localTmp := h.helper.RenderObject(t, tmpl, templateVars)

	// Create repository in this org's namespace
	repoClient := h.helper.GetResourceClient(apis.ResourceClientArgs{
		User:      h.user,
		Namespace: h.namespace,
		GVR:       provisioning.RepositoryResourceInfo.GroupVersionResource(),
	})

	_, err := repoClient.Resource.Create(context.Background(), localTmp, metav1.CreateOptions{})
	require.NoError(t, err, "should create repository in namespace %s", h.namespace)

	// Wait for healthy repository
	h.WaitForHealthyRepository(t, repo.Name)

	// Copy files if provided
	for from, to := range repo.Copies {
		if repo.Path != "" {
			// Copy to custom path
			fullPath := filepath.Join(repoPath, to)
			err := os.MkdirAll(filepath.Dir(fullPath), 0o750)
			require.NoError(t, err, "failed to create directories for custom path")
			file := readTestFile(t, h.helper, from)
			err = os.WriteFile(fullPath, file, 0o600)
			require.NoError(t, err, "failed to write file to custom path")
		} else {
			h.helper.CopyToProvisioningPath(t, from, to)
		}
	}

	if !repo.SkipSync {
		// Trigger and wait for initial sync
		h.SyncAndWait(t, repo.Name, nil)
	}
}

// SyncAndWait triggers a sync job and waits for completion in this org's namespace
func (h *OrgHelper) SyncAndWait(t *testing.T, repo string, options *provisioning.SyncJobOptions) {
	t.Helper()

	if options == nil {
		options = &provisioning.SyncJobOptions{}
	}
	body := common.AsJSON(&provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   options,
	})

	gv := &schema.GroupVersion{Group: "provisioning.grafana.app", Version: "v0alpha1"}
	restClient := h.user.RESTClient(t, gv)

	result := restClient.Post().
		Namespace(h.namespace).
		Resource("repositories").
		Name(repo).
		SubResource("jobs").
		Body(body).
		SetHeader("Content-Type", "application/json").
		Do(context.Background())

	require.NoError(t, result.Error(), "should trigger sync for repository %s in namespace %s", repo, h.namespace)

	// Wait for job completion
	h.AwaitJobs(t, repo)
}

// WaitForHealthyRepository waits for a repository to become healthy
func (h *OrgHelper) WaitForHealthyRepository(t *testing.T, repoName string) {
	t.Helper()

	repoClient := h.helper.GetResourceClient(apis.ResourceClientArgs{
		User:      h.user,
		Namespace: h.namespace,
		GVR:       provisioning.RepositoryResourceInfo.GroupVersionResource(),
	})

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := repoClient.Resource.Get(context.Background(), repoName, metav1.GetOptions{})
		if err != nil {
			collect.Errorf("failed to get repository: %v", err)
			return
		}

		conditions, found, err := unstructured.NestedSlice(obj.Object, "status", "conditions")
		if err != nil || !found {
			collect.Errorf("no conditions found")
			return
		}

		for _, c := range conditions {
			condition := c.(map[string]interface{})
			if condition["type"] == "Ready" && condition["status"] == "True" {
				return
			}
		}
		collect.Errorf("repository not ready")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "repository should become healthy")
}

// AwaitJobs waits for all jobs for a repository to complete
func (h *OrgHelper) AwaitJobs(t *testing.T, repoName string) {
	t.Helper()

	jobsClient := h.helper.GetResourceClient(apis.ResourceClientArgs{
		User:      h.user,
		Namespace: h.namespace,
		GVR:       provisioning.JobResourceInfo.GroupVersionResource(),
	})

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		jobs, err := jobsClient.Resource.List(context.Background(), metav1.ListOptions{
			FieldSelector: "metadata.namespace=" + h.namespace,
		})
		if err != nil {
			collect.Errorf("failed to list jobs: %v", err)
			return
		}

		for _, job := range jobs.Items {
			state, found, _ := unstructured.NestedString(job.Object, "status", "state")
			if !found {
				collect.Errorf("job %s has no state", job.GetName())
				return
			}
			// Job is complete if state is success, error, or warning
			if state != string(provisioning.JobStateSuccess) && state != string(provisioning.JobStateError) && state != string(provisioning.JobStateWarning) {
				collect.Errorf("job %s still running (state: %s)", job.GetName(), state)
				return
			}
			if state == string(provisioning.JobStateError) {
				message, _, _ := unstructured.NestedString(job.Object, "status", "message")
				collect.Errorf("job %s failed: %s", job.GetName(), message)
				return
			}
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "all jobs should complete")
}

// GetFolders lists folders in this organization's namespace
func (h *OrgHelper) GetFolders(t *testing.T) *unstructured.UnstructuredList {
	t.Helper()

	foldersClient := h.helper.GetResourceClient(apis.ResourceClientArgs{
		User:      h.user,
		Namespace: h.namespace,
		GVR:       schema.GroupVersionResource{Group: "folder.grafana.app", Resource: "folders", Version: "v1"},
	})

	folders, err := foldersClient.Resource.List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err, "should list folders in namespace %s", h.namespace)
	return folders
}

// GetDashboards lists dashboards in this organization's namespace
func (h *OrgHelper) GetDashboards(t *testing.T) *unstructured.UnstructuredList {
	t.Helper()

	dashboardsClient := h.helper.GetResourceClient(apis.ResourceClientArgs{
		User:      h.user,
		Namespace: h.namespace,
		GVR:       schema.GroupVersionResource{Group: "dashboard.grafana.app", Resource: "dashboards", Version: "v1"},
	})

	dashboards, err := dashboardsClient.Resource.List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err, "should list dashboards in namespace %s", h.namespace)
	return dashboards
}

// readTestFile reads a test file from testdata directory
func readTestFile(t *testing.T, h *common.ProvisioningTestHelper, filename string) []byte {
	t.Helper()

	sourceFile := filepath.Join(h.ProvisioningPath, "..", "testdata", filename)
	content, err := os.ReadFile(sourceFile)
	require.NoError(t, err, "should read test file %s", filename)
	return content
}

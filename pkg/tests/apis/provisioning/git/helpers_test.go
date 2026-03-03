package git

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/nanogit/gittest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folderv1beta1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	provisioningjobs "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

// GrafanaOpt is a functional option applied to GrafanaOpts before starting Grafana.
type GrafanaOpt func(*testinfra.GrafanaOpts)

const (
	waitTimeoutDefault  = 60 * time.Second
	waitIntervalDefault = 200 * time.Millisecond
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// gitTestHelper wraps a Grafana test instance and a Gitea server for
// git-based provisioning integration tests. It mirrors the structure
// of provisioningTestHelper in the parent provisioning package.
type gitTestHelper struct {
	*apis.K8sTestHelper
	Repositories *apis.K8sResourceClient
	Jobs         *apis.K8sResourceClient
	DashboardsV1 *apis.K8sResourceClient
	Folders      *apis.K8sResourceClient
	AdminREST    *rest.RESTClient
	EditorREST   *rest.RESTClient
	ViewerREST   *rest.RESTClient

	gitServer *gittest.Server
}

// runGrafanaWithGitServer starts both a Grafana test instance and a Gitea
// server in a container. The Gitea server is available on the returned helper
// for creating test repositories.
//
// Pass functional options to override any GrafanaOpts defaults before startup,
// e.g. to set ProvisioningMaxResourcesPerRepository for quota tests.
func runGrafanaWithGitServer(t *testing.T, options ...GrafanaOpt) *gitTestHelper {
	t.Helper()

	ctx := context.Background()

	server, err := gittest.NewServer(ctx,
		gittest.WithLogger(gittest.NewTestLogger(t)),
	)
	require.NoError(t, err, "failed to start gittest server")
	t.Cleanup(func() {
		if err := server.Cleanup(); err != nil {
			t.Logf("failed to cleanup git server: %v", err)
		}
	})

	opts := testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{
			featuremgmt.FlagProvisioning,
			featuremgmt.FlagProvisioningExport,
		},
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"dashboards.dashboard.grafana.app": {
				DualWriterMode:  grafanarest.Mode5,
				EnableMigration: true,
			},
			"folders.folder.grafana.app": {
				DualWriterMode:  grafanarest.Mode5,
				EnableMigration: true,
			},
		},
		ProvisioningAllowedTargets:  []string{"folder", "instance"},
		ProvisioningRepositoryTypes: []string{"git"},
	}
	for _, o := range options {
		o(&opts)
	}

	k8s := apis.NewK8sTestHelper(t, opts)

	gv := &schema.GroupVersion{Group: "provisioning.grafana.app", Version: "v0alpha1"}

	repositories := k8s.GetResourceClient(apis.ResourceClientArgs{
		User:      k8s.Org1.Admin,
		Namespace: "default",
		GVR:       provisioning.RepositoryResourceInfo.GroupVersionResource(),
	})
	jobsClient := k8s.GetResourceClient(apis.ResourceClientArgs{
		User:      k8s.Org1.Admin,
		Namespace: "default",
		GVR:       provisioning.JobResourceInfo.GroupVersionResource(),
	})
	dashboardsV1 := k8s.GetResourceClient(apis.ResourceClientArgs{
		User:      k8s.Org1.Admin,
		Namespace: "default",
		GVR:       dashboardV1.DashboardResourceInfo.GroupVersionResource(),
	})
	folders := k8s.GetResourceClient(apis.ResourceClientArgs{
		User:      k8s.Org1.Admin,
		Namespace: "default",
		GVR:       folderv1beta1.FolderResourceInfo.GroupVersionResource(),
	})

	adminREST := k8s.Org1.Admin.RESTClient(t, gv)
	editorREST := k8s.Org1.Editor.RESTClient(t, gv)
	viewerREST := k8s.Org1.Viewer.RESTClient(t, gv)

	// Clean any pre-existing state from prior test runs.
	cleanupResources(t, dashboardsV1)
	cleanupResources(t, folders)
	cleanupResources(t, repositories)

	return &gitTestHelper{
		K8sTestHelper: k8s,
		Repositories:  repositories,
		Jobs:          jobsClient,
		DashboardsV1:  dashboardsV1,
		Folders:       folders,
		AdminREST:     adminREST,
		EditorREST:    editorREST,
		ViewerREST:    viewerREST,
		gitServer:     server,
	}
}

// createGitRepo creates a Gitea repository with optional initial file content
// and registers it as a git-type provisioning repository in Grafana. A fresh
// user is created for each call so repositories are fully isolated.
//
// initialFiles maps file paths to their raw content (e.g. {"dash.json": dashboardJSON(...)}).
// workflows lists any write workflows to enable (e.g. "write", "branch");
// when empty no write workflow is enabled (read-only repository).
func (h *gitTestHelper) createGitRepo(t *testing.T, repoName string, initialFiles map[string][]byte, workflows ...string) (*gittest.RemoteRepository, *gittest.LocalRepo) {
	t.Helper()

	ctx := context.Background()

	user, err := h.gitServer.CreateUser(ctx)
	require.NoError(t, err, "failed to create gittest user")

	remote, err := h.gitServer.CreateRepo(ctx, gittest.RandomRepoName(), user)
	require.NoError(t, err, "failed to create gittest remote repository")

	local, err := gittest.NewLocalRepo(ctx,
		gittest.WithRepoLogger(gittest.NewTestLogger(t)),
	)
	require.NoError(t, err, "failed to create local git repository")
	t.Cleanup(func() {
		if err := local.Cleanup(); err != nil {
			t.Logf("failed to cleanup local repo: %v", err)
		}
	})

	_, err = local.InitWithRemote(user, remote)
	require.NoError(t, err, "failed to initialize local repository with remote")

	if len(initialFiles) > 0 {
		for path, content := range initialFiles {
			err = local.CreateFile(path, string(content))
			require.NoError(t, err, "failed to create initial file %q", path)
		}
		_, err = local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "initial content")
		require.NoError(t, err)
		_, err = local.Git("push", "origin", "main")
		require.NoError(t, err, "failed to push initial files")
	}

	workflowList := make([]interface{}, len(workflows))
	for i, w := range workflows {
		workflowList[i] = w
	}

	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]interface{}{
				"name":      repoName,
				"namespace": "default",
			},
			"spec": map[string]interface{}{
				"title":       fmt.Sprintf("Test Repository %s", repoName),
				"description": fmt.Sprintf("Integration test repository for %s", repoName),
				"type":        "git",
				"git": map[string]interface{}{
					"url":       remote.URL,
					"branch":    "main",
					"tokenUser": user.Username,
				},
				"sync": map[string]interface{}{
					"enabled":         false,
					"target":          "instance",
					"intervalSeconds": int64(60),
				},
				"workflows": workflowList,
			},
			"secure": map[string]interface{}{
				"token": map[string]interface{}{
					"create": user.Password,
				},
			},
		},
	}

	_, err = h.Repositories.Resource.Create(t.Context(), obj, metav1.CreateOptions{})
	require.NoError(t, err, "failed to create Grafana repository %q", repoName)

	h.waitForHealthyRepo(t, repoName)

	return remote, local
}

// waitForHealthyRepo polls until the named repository reports a healthy status,
// meaning Grafana has successfully connected to the git remote.
func (h *gitTestHelper) waitForHealthyRepo(t *testing.T, repoName string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		obj, err := h.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(c, err, "failed to get repository") {
			return
		}
		errMsg, _, _ := unstructured.NestedString(obj.Object, "status", "health", "error")
		assert.Empty(c, errMsg, "repository %s has health error: %s", repoName, errMsg)
		healthy, found, _ := unstructured.NestedBool(obj.Object, "status", "health", "healthy")
		assert.True(c, found, "repository %s health status not set", repoName)
		assert.True(c, healthy, "repository %s is not healthy", repoName)
	}, waitTimeoutDefault, waitIntervalDefault, "repository %q should become healthy", repoName)
}

// syncAndWait triggers a full pull sync on the named repository and waits for
// all active jobs to complete.
func (h *gitTestHelper) syncAndWait(t *testing.T, repoName string) {
	t.Helper()
	h.triggerSyncAndWait(t, repoName, false)
}

// syncAndWaitIncremental triggers an incremental pull sync — only files changed
// since the previous sync (LastRef) are processed — and waits for completion.
func (h *gitTestHelper) syncAndWaitIncremental(t *testing.T, repoName string) {
	t.Helper()
	h.triggerSyncAndWait(t, repoName, true)
}

func (h *gitTestHelper) triggerSyncAndWait(t *testing.T, repoName string, incremental bool) {
	t.Helper()

	body := asJSON(&provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{Incremental: incremental},
	})

	result := h.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("jobs").
		Body(body).
		SetHeader("Content-Type", "application/json").
		Do(t.Context())

	if apierrors.IsAlreadyExists(result.Error()) {
		h.waitForJobsComplete(t, repoName)
		return
	}

	obj, err := result.Get()
	require.NoError(t, err, "failed to trigger sync job")

	u, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok, "expected Unstructured response, got %T", obj)
	require.NotEmpty(t, u.GetName(), "sync job should have a name")

	h.waitForJobsComplete(t, repoName)
}

// waitForJobsComplete snapshots the active jobs for a repository by label, then
// polls until every captured job disappears from the active queue. If no jobs
// are found at snapshot time a failsafe pull job is posted first so there is
// always at least one job to wait on.
func (h *gitTestHelper) waitForJobsComplete(t *testing.T, repoName string) {
	t.Helper()

	list, err := h.Jobs.Resource.List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err, "failed to list active jobs")

	waitFor := map[string]bool{}
	for _, item := range list.Items {
		if item.GetLabels()[provisioningjobs.LabelRepository] == repoName {
			waitFor[item.GetName()] = false
		}
	}

	// Failsafe: if no jobs are currently queued, post a pull job so there is
	// always something to wait on (mirrors provisioningTestHelper.AwaitJobs).
	if len(waitFor) == 0 {
		body := asJSON(&provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		h.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(context.Background())

		list, err = h.Jobs.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err, "failed to list active jobs after failsafe post")
		for _, item := range list.Items {
			if item.GetLabels()[provisioningjobs.LabelRepository] == repoName {
				waitFor[item.GetName()] = false
			}
		}
	}

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		for name := range waitFor {
			_, err := h.Jobs.Resource.Get(context.Background(), name, metav1.GetOptions{})
			switch {
			case err == nil:
				c.Errorf("job %q for repo %q is still active", name, repoName)
			case apierrors.IsNotFound(err):
				waitFor[name] = true
			default:
				c.Errorf("unexpected error getting job %q: %v", name, err)
			}
		}
		for name, done := range waitFor {
			if !done {
				c.Errorf("job %q for repo %q has not completed", name, repoName)
			}
		}
	}, waitTimeoutDefault, waitIntervalDefault, "all jobs for repo %q should complete", repoName)
}

// cleanupResources deletes every resource returned by the given client.
func cleanupResources(t *testing.T, client *apis.K8sResourceClient) {
	t.Helper()
	list, err := client.Resource.List(context.Background(), metav1.ListOptions{})
	if err != nil {
		t.Logf("warning: failed to list resources for cleanup: %v", err)
		return
	}
	for _, item := range list.Items {
		if err := client.Resource.Delete(context.Background(), item.GetName(), metav1.DeleteOptions{}); err != nil {
			t.Logf("warning: failed to delete resource %q: %v", item.GetName(), err)
		}
	}
}

// dashboardJSON returns a complete classic Grafana dashboard JSON blob as []byte.
// The three fields panels, schemaVersion, and tags are all required by the
// classic dashboard parser (ReadClassicResource) to identify the blob as a dashboard.
func dashboardJSON(uid, title string, version int) []byte {
	d := map[string]interface{}{
		"uid":           uid,
		"title":         title,
		"tags":          []interface{}{},
		"timezone":      "browser",
		"schemaVersion": 39,
		"version":       version,
		"refresh":       "",
		"panels":        []interface{}{},
	}
	b, err := json.MarshalIndent(d, "", "\t")
	if err != nil {
		panic(fmt.Sprintf("dashboardJSON: %v", err))
	}
	return b
}

// asJSON serialises v to a JSON byte slice, panicking on encoding errors
// (acceptable in test helpers where the input is always a known-good struct).
func asJSON(v interface{}) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic(fmt.Sprintf("asJSON: %v", err))
	}
	return b
}

// triggerJobAndWaitForComplete posts a sync job and blocks until the job
// finishes (appears in the repository's historic job list). The completed job
// object is returned so callers can inspect its state and warnings.
func (h *gitTestHelper) triggerJobAndWaitForComplete(t *testing.T, repoName string, spec provisioning.JobSpec) *unstructured.Unstructured {
	t.Helper()

	result := h.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("jobs").
		Body(asJSON(spec)).
		SetHeader("Content-Type", "application/json").
		Do(t.Context())

	if apierrors.IsAlreadyExists(result.Error()) {
		t.Logf("job already running for repo %q; waiting for completion", repoName)
		h.waitForJobsComplete(t, repoName)
		return h.awaitLatestHistoricJob(t, repoName)
	}

	obj, err := result.Get()
	require.NoError(t, err, "failed to trigger job for repo %q", repoName)

	u, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok, "expected Unstructured response, got %T", obj)
	require.NotEmpty(t, u.GetName(), "triggered job should have a name")

	return h.awaitJob(t, repoName, u)
}

// awaitJob polls repositories/{repo}/jobs/{uid} until the job appears in the
// historic job list (i.e. has completed), then returns the result.
func (h *gitTestHelper) awaitJob(t *testing.T, repoName string, job *unstructured.Unstructured) *unstructured.Unstructured {
	t.Helper()

	var lastResult *unstructured.Unstructured
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		result, err := h.Repositories.Resource.Get(
			t.Context(), repoName, metav1.GetOptions{},
			"jobs", string(job.GetUID()),
		)
		if !assert.NoError(c, err, "failed to get historic job %q", job.GetName()) {
			return
		}
		lastResult = result
	}, waitTimeoutDefault, waitIntervalDefault, "job %q should complete", job.GetName())

	require.NotNil(t, lastResult)
	return lastResult
}

// awaitLatestHistoricJob waits for the active job queue to drain, then returns
// the most recently created historic job for the repository.
func (h *gitTestHelper) awaitLatestHistoricJob(t *testing.T, repoName string) *unstructured.Unstructured {
	t.Helper()

	h.waitForJobsComplete(t, repoName)

	result, err := h.Repositories.Resource.Get(context.Background(), repoName, metav1.GetOptions{}, "jobs")
	require.NoError(t, err, "failed to list historic jobs for repo %q", repoName)
	list, err := result.ToList()
	require.NoError(t, err, "historic jobs result should be a list")
	require.NotEmpty(t, list.Items, "expected at least one historic job for repo %q", repoName)

	latest := list.Items[0]
	for i := 1; i < len(list.Items); i++ {
		if list.Items[i].GetCreationTimestamp().After(latest.GetCreationTimestamp().Time) {
			latest = list.Items[i]
		}
	}
	return latest.DeepCopy()
}

// waitForQuotaReconciliation polls until the repository's ResourceQuota
// condition reaches the expected reason (e.g. provisioning.ReasonQuotaReached).
func (h *gitTestHelper) waitForQuotaReconciliation(t *testing.T, repoName, expectedReason string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		repoObj, err := h.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(c, err, "failed to get repository %q", repoName) {
			return
		}
		repo := unstructuredToRepository(t, repoObj)
		cond := findCondition(repo.Status.Conditions, provisioning.ConditionTypeResourceQuota)
		if !assert.NotNil(c, cond, "quota condition not found on repo %q", repoName) {
			return
		}
		assert.Equal(c, expectedReason, cond.Reason,
			"quota condition reason mismatch for repo %q", repoName)
	}, waitTimeoutDefault, waitIntervalDefault,
		"quota condition on repo %q should reach reason %q", repoName, expectedReason)
}

// waitForConditionReason polls until the named condition type on the repository
// reaches the expected reason string.
func (h *gitTestHelper) waitForConditionReason(t *testing.T, repoName, conditionType, expectedReason string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		repoObj, err := h.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(c, err, "failed to get repository %q", repoName) {
			return
		}
		repo := unstructuredToRepository(t, repoObj)
		cond := findCondition(repo.Status.Conditions, conditionType)
		if !assert.NotNil(c, cond, "condition %q not found on repo %q", conditionType, repoName) {
			return
		}
		assert.Equal(c, expectedReason, cond.Reason,
			"condition %q reason mismatch for repo %q", conditionType, repoName)
	}, waitTimeoutDefault, waitIntervalDefault,
		"condition %q on repo %q should reach reason %q", conditionType, repoName, expectedReason)
}

// requireRepoDashboardCount asserts the number of dashboards whose
// grafana.app/managerId annotation matches repoName.
func requireRepoDashboardCount(t *testing.T, h *gitTestHelper, ctx context.Context, repoName string, expected int) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := h.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list dashboards") {
			return
		}
		var count int
		for _, d := range list.Items {
			if mgr, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/managerId"); mgr == repoName {
				count++
			}
		}
		assert.Equal(c, expected, count, "unexpected dashboard count for repo %q", repoName)
	}, waitTimeoutDefault, waitIntervalDefault,
		"expected %d dashboard(s) for repo %q", expected, repoName)
}

// unstructuredToRepository converts an Unstructured object to a typed Repository.
func unstructuredToRepository(t *testing.T, obj *unstructured.Unstructured) *provisioning.Repository {
	t.Helper()
	b, err := obj.MarshalJSON()
	require.NoError(t, err)
	repo := &provisioning.Repository{}
	require.NoError(t, json.Unmarshal(b, repo))
	return repo
}

// findCondition returns the first condition with the given type, or nil.
func findCondition(conditions []metav1.Condition, conditionType string) *metav1.Condition {
	for i := range conditions {
		if conditions[i].Type == conditionType {
			return &conditions[i]
		}
	}
	return nil
}

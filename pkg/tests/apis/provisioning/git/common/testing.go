package common

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	folderV1beta1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/nanogit/gittest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/infra/db"
)

// GrafanaOpt is a functional option applied to GrafanaOpts before starting Grafana.
type GrafanaOpt func(*testinfra.GrafanaOpts)

const (
	WaitTimeoutDefault  = 60 * time.Second
	WaitIntervalDefault = 100 * time.Millisecond
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// dashboardJSON generates a valid dashboard JSON for testing
func DashboardJSON(uid, title string, version int) []byte {
	dashboard := map[string]interface{}{
		"uid":           uid,
		"title":         title,
		"tags":          []string{},
		"timezone":      "browser",
		"schemaVersion": 39,
		"version":       version,
		"refresh":       "",
		"panels":        []interface{}{},
	}
	data, _ := json.MarshalIndent(dashboard, "", "\t")
	return data
}

// GitTestHelper wraps the standard test helper with git-specific functionality
type GitTestHelper struct {
	*apis.K8sTestHelper
	gitServer    *gittest.Server
	Repositories *apis.K8sResourceClient
	Jobs         *apis.K8sResourceClient
	AdminREST    *rest.RESTClient
	EditorREST   *rest.RESTClient
	ViewerREST   *rest.RESTClient
	DashboardsV1 *apis.K8sResourceClient
	FoldersV1    *apis.K8sResourceClient
}

// SharedGitEnv lazily starts and reuses one GitTestHelper across tests.
// Tests still create fresh repositories and local clones; only the Grafana
// server and gittest server are shared.
type SharedGitEnv struct {
	Helper       *GitTestHelper
	shutdownFunc func()
	once         sync.Once
	initErr      string
	options      []GrafanaOpt
}

// NewSharedGitEnv creates a lazily initialized shared Git test environment.
func NewSharedGitEnv(options ...GrafanaOpt) *SharedGitEnv {
	return &SharedGitEnv{options: options}
}

// runGrafanaWithGitServer starts both a Grafana test instance and a git server.
// Pass functional options to override any GrafanaOpts defaults before startup,
// e.g. to set ProvisioningMaxResourcesPerRepository for quota tests.
func RunGrafanaWithGitServer(t *testing.T, options ...GrafanaOpt) *GitTestHelper {
	t.Helper()

	ctx := context.Background()

	// Start git server using gittest
	gitServer, err := gittest.NewServer(ctx, gittest.WithLogger(gittest.NewTestLogger(t)))
	require.NoError(t, err, "failed to start git server")
	t.Cleanup(func() {
		if err := gitServer.Cleanup(); err != nil {
			t.Logf("failed to cleanup git server: %v", err)
		}
	})

	return newGitTestHelper(t, apis.NewK8sTestHelper(t, gitGrafanaOpts(options...)), gitServer)
}

// RunGrafanaWithGitServerShared is like RunGrafanaWithGitServer but keeps the
// servers alive until the returned shutdown function is called.
func RunGrafanaWithGitServerShared(t *testing.T, options ...GrafanaOpt) (*GitTestHelper, func()) {
	t.Helper()

	ctx := context.Background()
	gitServer, err := gittest.NewServer(ctx, gittest.WithLogger(gittest.NewWriterLogger(os.Stderr)))
	require.NoError(t, err, "failed to start git server")

	k8s, serverShutdown := apis.NewK8sTestHelperShared(t, apis.K8sTestHelperOpts{
		GrafanaOpts: gitGrafanaOpts(options...),
	})
	shutdown := func() {
		if err := gitServer.Cleanup(); err != nil {
			_, _ = fmt.Fprintf(os.Stderr, "failed to cleanup git server: %v\n", err)
		}
		serverShutdown()
	}

	return newGitTestHelper(t, k8s, gitServer), shutdown
}

// GetHelper returns the shared helper, starting it on first use.
func (e *SharedGitEnv) GetHelper(t *testing.T) *GitTestHelper {
	t.Helper()
	testutil.SkipIntegrationTestInShortMode(t)

	e.once.Do(func() {
		defer func() {
			if r := recover(); r != nil {
				e.initErr = fmt.Sprintf("shared git server init panicked: %v", r)
			} else if e.Helper == nil && e.initErr == "" {
				e.initErr = "shared git server init failed (FailNow/Goexit called; see first test output)"
			}
		}()
		e.Helper, e.shutdownFunc = RunGrafanaWithGitServerShared(t, e.options...)
	})

	if e.initErr != "" {
		t.Fatalf("SharedGitEnv: %s", e.initErr)
	}

	return e.Helper
}

// GetCleanHelper returns the shared helper after removing resources left by a
// previous test from Grafana. Git server state is intentionally not reset.
func (e *SharedGitEnv) GetCleanHelper(t *testing.T) *GitTestHelper {
	t.Helper()
	h := e.GetHelper(t)
	h.CleanupAllResources(t, context.Background())
	return h
}

// Shutdown stops the shared servers if they were started.
func (e *SharedGitEnv) Shutdown() {
	if e.shutdownFunc != nil {
		e.shutdownFunc()
	}
}

// RunTestMain replaces testsuite.Run(m) for packages that share one Git test
// environment. It handles DB setup, executes the package tests, shuts down the
// shared servers, cleans the DB, and exits.
func (e *SharedGitEnv) RunTestMain(m *testing.M) {
	db.SetupTestDB()
	code := m.Run()
	e.Shutdown()
	db.CleanupTestDB()
	os.Exit(code)
}

func (h *GitTestHelper) GitServer() *gittest.Server {
	return h.gitServer
}

// CleanupAllResources removes Grafana-managed resources left by a previous
// test. Remote git repositories are not deleted because the shared gittest
// server does not expose repo/user cleanup and tests already isolate by using
// fresh users and local clones per repository.
func (h *GitTestHelper) CleanupAllResources(t *testing.T, ctx context.Context) {
	t.Helper()
	h.waitForNoActiveJobs(t)

	for _, c := range []struct {
		name   string
		client dynamic.ResourceInterface
	}{
		{"repositories", h.Repositories.Resource},
		{"dashboards", h.DashboardsV1.Resource},
		{"folders", h.FoldersV1.Resource},
	} {
		if err := deleteAndWait(ctx, c.client, 10*time.Second); err != nil {
			t.Fatalf("CleanupAllResources(%s): %v", c.name, err)
		}
	}
}

// CreateGitRepo creates a git repository with sync target "instance" and registers
// it with Grafana provisioning. workflows is optional; defaults to ["write"].
func (h *GitTestHelper) CreateGitRepo(t *testing.T, repoName string, initialFiles map[string][]byte, workflows ...string) (*gittest.RemoteRepository, *gittest.LocalRepo) {
	return h.createGitRepo(t, repoName, "instance", initialFiles, workflows...)
}

// CreateFolderTargetGitRepo creates a git repository with sync target "folder" and
// registers it with Grafana provisioning. Unlike "instance" repos, multiple "folder"
// repos can coexist on the same Grafana server. workflows is optional; defaults to ["write"].
func (h *GitTestHelper) CreateFolderTargetGitRepo(t *testing.T, repoName string, initialFiles map[string][]byte, workflows ...string) (*gittest.RemoteRepository, *gittest.LocalRepo) {
	return h.createGitRepo(t, repoName, "folder", initialFiles, workflows...)
}

// createGitRepo is the shared implementation for CreateGitRepo and CreateFolderTargetGitRepo.
func (h *GitTestHelper) createGitRepo(t *testing.T, repoName string, syncTarget string, initialFiles map[string][]byte, workflows ...string) (*gittest.RemoteRepository, *gittest.LocalRepo) {
	t.Helper()

	ctx := context.Background()

	// Create user and remote repository
	user, err := h.gitServer.CreateUser(ctx)
	require.NoError(t, err, "failed to create user")

	remote, err := h.gitServer.CreateRepo(ctx, repoName, user)
	require.NoError(t, err, "failed to create remote repository")

	local, err := gittest.NewLocalRepo(ctx)
	require.NoError(t, err, "failed to create local repository")
	t.Cleanup(func() {
		if err := local.Cleanup(); err != nil {
			t.Logf("failed to cleanup local repo: %v", err)
		}
	})

	// Initialize local repo with remote and initial commit
	_, err = local.InitWithRemote(user, remote)
	require.NoError(t, err, "failed to initialize local repo with remote")

	// Add initial files if provided
	for path, content := range initialFiles {
		err = local.CreateFile(path, string(content))
		require.NoError(t, err, "failed to create file %s", path)
	}

	if len(initialFiles) > 0 {
		_, err = local.Git("add", ".")
		require.NoError(t, err, "failed to add files")
		_, err = local.Git("commit", "-m", "Add initial files")
		require.NoError(t, err, "failed to commit files")
		_, err = local.Git("push")
		require.NoError(t, err, "failed to push files")
	}

	// Default to ["write"] if no workflows specified
	if len(workflows) == 0 {
		workflows = []string{"write"}
	}

	// Register repository with Grafana
	repoSpec := map[string]interface{}{
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
				"path":      "",
				"tokenUser": user.Username,
			},
			"sync": map[string]interface{}{
				"enabled":         false,
				"target":          syncTarget,
				"intervalSeconds": 60,
			},
			"workflows": workflows,
		},
		"secure": map[string]interface{}{
			"token": map[string]interface{}{
				"create": user.Password,
			},
		},
	}

	repoJSON, err := json.Marshal(repoSpec)
	require.NoError(t, err)

	result := h.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Body(repoJSON).
		SetHeader("Content-Type", "application/json").
		Do(context.Background())

	require.NoError(t, result.Error(), "failed to create repository")

	// Wait for repository to be ready
	h.waitForReadyRepository(t, repoName)

	return remote, local
}

// waitForReadyRepository waits for a repository to have Ready=True condition
func (h *GitTestHelper) waitForReadyRepository(t *testing.T, repoName string) {
	t.Helper()

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		repo, err := h.Repositories.Resource.Get(context.Background(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err, "failed to get repository") {
			return
		}

		// Check for Ready condition
		conditions, found, err := unstructured.NestedSlice(repo.Object, "status", "conditions")
		if !assert.NoError(collect, err) {
			return
		}

		if !found || len(conditions) == 0 {
			collect.Errorf("no conditions found for repository %s", repoName)
			return
		}

		// Look for Ready=True condition
		ready := false
		for _, cond := range conditions {
			condMap := cond.(map[string]interface{})
			condType, _ := condMap["type"].(string)
			condStatus, _ := condMap["status"].(string)
			condReason, _ := condMap["reason"].(string)
			condMessage, _ := condMap["message"].(string)

			t.Logf("Repository %s condition: type=%s status=%s reason=%s message=%s",
				repoName, condType, condStatus, condReason, condMessage)

			if condType == "Ready" && condStatus == "True" {
				ready = true
				break
			}
		}

		assert.True(collect, ready, "repository not ready")
	}, WaitTimeoutDefault, WaitIntervalDefault, "repository %s should become ready", repoName)
}

// syncAndWait triggers a full pull sync on the named repository and waits for
// all active jobs to complete.
func (h *GitTestHelper) SyncAndWait(t *testing.T, repoName string) {
	t.Helper()

	jobSpec := map[string]interface{}{
		"action": "pull",
		"pull":   map[string]interface{}{},
	}

	jobJSON, err := json.Marshal(jobSpec)
	require.NoError(t, err)

	result := h.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("jobs").
		Body(jobJSON).
		SetHeader("Content-Type", "application/json").
		Do(context.Background())

	if apierrors.IsAlreadyExists(result.Error()) {
		h.waitForJobsComplete(t, repoName)
		return
	}

	require.NoError(t, result.Error(), "failed to trigger sync")
	h.waitForJobsComplete(t, repoName)
}

// syncAndWaitIncremental triggers an incremental pull sync on the named
// repository and waits for all active jobs to complete.
//
//nolint:unused // Called from incremental_folder_metadata_test.go

func (h *GitTestHelper) SyncAndWaitIncremental(t *testing.T, repoName string) {
	t.Helper()
	h.triggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{Incremental: true},
	})
}

// TriggerJobAndWaitForComplete implements common.SyncHelper.
func (h *GitTestHelper) TriggerJobAndWaitForComplete(t *testing.T, repoName string, spec provisioning.JobSpec) *unstructured.Unstructured {
	return h.triggerJobAndWaitForComplete(t, repoName, spec)
}

// GetRepositories implements common.SyncHelper.
func (h *GitTestHelper) GetRepositories() *apis.K8sResourceClient {
	return h.Repositories
}

// waitForJobsComplete waits for all active jobs for a repository to complete.
func (h *GitTestHelper) waitForJobsComplete(t *testing.T, repoName string) {
	t.Helper()

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		jobs, err := h.Jobs.Resource.List(context.Background(), metav1.ListOptions{})
		if !assert.NoError(collect, err, "failed to list jobs") {
			return
		}

		hasActiveJobs := false
		for _, job := range jobs.Items {
			labels := job.GetLabels()
			if labels["provisioning.grafana.app/repository"] == repoName {
				hasActiveJobs = true
				break
			}
		}

		assert.False(collect, hasActiveJobs, "jobs still active for repository %s", repoName)
	}, WaitTimeoutDefault, WaitIntervalDefault, "jobs should complete for repository %s", repoName)
}

func (h *GitTestHelper) waitForNoActiveJobs(t *testing.T) {
	t.Helper()

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		jobs, err := h.Jobs.Resource.List(context.Background(), metav1.ListOptions{})
		if !assert.NoError(collect, err, "failed to list jobs") {
			return
		}
		assert.Empty(collect, jobs.Items, "jobs still active from previous test")
	}, WaitTimeoutDefault, WaitIntervalDefault, "jobs should complete before cleanup")
}

func gitGrafanaOpts(options ...GrafanaOpt) testinfra.GrafanaOpts {
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
	return opts
}

func newGitTestHelper(t *testing.T, k8s *apis.K8sTestHelper, gitServer *gittest.Server) *GitTestHelper {
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

	foldersV1 := k8s.GetResourceClient(apis.ResourceClientArgs{
		User:      k8s.Org1.Admin,
		Namespace: "default",
		GVR:       folderV1beta1.FolderResourceInfo.GroupVersionResource(),
	})

	gv := &schema.GroupVersion{Group: "provisioning.grafana.app", Version: "v0alpha1"}

	return &GitTestHelper{
		K8sTestHelper: k8s,
		gitServer:     gitServer,
		Repositories:  repositories,
		Jobs:          jobsClient,
		DashboardsV1:  dashboardsV1,
		FoldersV1:     foldersV1,
		AdminREST:     k8s.Org1.Admin.RESTClient(t, gv),
		EditorREST:    k8s.Org1.Editor.RESTClient(t, gv),
		ViewerREST:    k8s.Org1.Viewer.RESTClient(t, gv),
	}
}

func deleteAndWait(ctx context.Context, client dynamic.ResourceInterface, timeout time.Duration) error {
	list, err := client.List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("deleteAndWait: initial list: %w", err)
	}
	if len(list.Items) == 0 {
		return nil
	}

	var firstErr error
	for _, item := range list.Items {
		if err := client.Delete(ctx, item.GetName(), metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
			if firstErr == nil {
				firstErr = fmt.Errorf("deleteAndWait: delete %q: %w", item.GetName(), err)
			}
		}
	}

	timer := time.NewTimer(timeout)
	defer timer.Stop()
	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	for {
		remaining, err := client.List(ctx, metav1.ListOptions{})
		if err != nil {
			return fmt.Errorf("deleteAndWait: list while polling: %w", err)
		}
		if len(remaining.Items) == 0 {
			return nil
		}
		for _, item := range remaining.Items {
			if err := client.Delete(ctx, item.GetName(), metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
				if firstErr == nil {
					firstErr = fmt.Errorf("deleteAndWait: delete %q: %w", item.GetName(), err)
				}
			}
		}
		select {
		case <-ctx.Done():
			if firstErr != nil {
				return fmt.Errorf("deleteAndWait: context cancelled (first delete error: %v): %w", firstErr, ctx.Err())
			}
			return fmt.Errorf("deleteAndWait: context cancelled: %w", ctx.Err())
		case <-timer.C:
			if firstErr != nil {
				return fmt.Errorf("deleteAndWait: timed out with %d items remaining (first delete error: %v)", len(remaining.Items), firstErr)
			}
			return fmt.Errorf("deleteAndWait: timed out with %d items remaining", len(remaining.Items))
		case <-ticker.C:
		}
	}
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
func (h *GitTestHelper) triggerJobAndWaitForComplete(t *testing.T, repoName string, spec provisioning.JobSpec) *unstructured.Unstructured {
	t.Helper()

	result := h.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("jobs").
		Body(asJSON(spec)).
		SetHeader("Content-Type", "application/json").
		Do(context.Background())

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
func (h *GitTestHelper) awaitJob(t *testing.T, repoName string, job *unstructured.Unstructured) *unstructured.Unstructured {
	t.Helper()

	var lastResult *unstructured.Unstructured
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		result, err := h.Repositories.Resource.Get(
			context.Background(), repoName, metav1.GetOptions{},
			"jobs", string(job.GetUID()),
		)
		if !assert.NoError(c, err, "failed to get historic job %q", job.GetName()) {
			return
		}
		lastResult = result
	}, WaitTimeoutDefault, WaitIntervalDefault, "job %q should complete", job.GetName())

	require.NotNil(t, lastResult)
	return lastResult
}

// awaitLatestHistoricJob waits for the active job queue to drain, then returns
// the most recently created historic job for the repository.
func (h *GitTestHelper) awaitLatestHistoricJob(t *testing.T, repoName string) *unstructured.Unstructured {
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

// WaitForQuotaReconciliation polls until the repository's ResourceQuota
// condition reaches the expected reason (e.g. provisioning.ReasonQuotaReached).
func (h *GitTestHelper) WaitForQuotaReconciliation(t *testing.T, repoName, expectedReason string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		repoObj, err := h.Repositories.Resource.Get(context.Background(), repoName, metav1.GetOptions{})
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
	}, WaitTimeoutDefault, WaitIntervalDefault,
		"quota condition on repo %q should reach reason %q", repoName, expectedReason)
}

// RequireRepoDashboardCount asserts the number of dashboards whose
// grafana.app/managerId annotation matches repoName.
func RequireRepoDashboardCount(t *testing.T, h *GitTestHelper, ctx context.Context, repoName string, expected int) {
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
	}, WaitTimeoutDefault, WaitIntervalDefault,
		"expected %d dashboard(s) for repo %q", expected, repoName)
}

// RequireRepoFolderCount asserts the number of folders whose
// grafana.app/managerId annotation matches repoName.
func RequireRepoFolderCount(t *testing.T, h *GitTestHelper, ctx context.Context, repoName string, expected int) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := h.FoldersV1.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list folders") {
			return
		}
		var count int
		for _, f := range list.Items {
			if mgr, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/managerId"); mgr == repoName {
				count++
			}
		}
		assert.Equal(c, expected, count, "unexpected folder count for repo %q", repoName)
	}, WaitTimeoutDefault, WaitIntervalDefault,
		"expected %d folder(s) for repo %q", expected, repoName)
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

// requireJobWarningContains asserts that at least one warning in the job status
// contains the given substring.
func RequireJobWarningContains(t *testing.T, jobObj *provisioning.Job, substr string) {
	t.Helper()
	for _, w := range jobObj.Status.Warnings {
		if strings.Contains(w, substr) {
			return
		}
	}
	t.Errorf("expected at least one warning containing %q, got warnings: %v", substr, jobObj.Status.Warnings)
}

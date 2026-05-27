package git

import (
	"context"
	"fmt"
	"strings"
	"testing"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/nanogit/gittest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// These tests are regression tests for grafana/grafana#124620. Writing a
// repo-managed dashboard through the Dashboard API used to forward the
// request to the provisioning files endpoint without a `message` query
// parameter, which made nanogit's StagedWriter.Commit fail with
// `commit changes: empty commit message` (HTTP 500).
//
// Each test stands up a fresh git-backed repository with sync enabled so the
// proxied write reflects into unified storage (otherwise the post-write
// Get inside handleManagedResourceRouting would fail with KeyNotFound on
// Create). The tests assert two things:
//   1. The Dashboard API call returns no error (no empty-message failure).
//   2. The resulting git commit message on origin/main matches either the
//      caller-supplied grafana.app/message annotation or the action-specific
//      fallback ("Create <name>" / "Update <name>" / "Delete <name>").

func TestIntegrationGit_ManagedDashboardUpdate_CommitMessage(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const (
		repoName     = "managed-msg-update"
		dashboardUID = "msg-update-dash"
		dashboardFn  = "dashboard.json"
	)

	local := createSyncEnabledGitRepo(t, helper, repoName, map[string][]byte{
		dashboardFn: common.DashboardJSON(dashboardUID, "Managed Dashboard", 1),
	})
	helper.SyncAndWait(t, repoName)
	waitForRepoManagedDashboard(t, helper, dashboardUID, repoName, dashboardFn)

	t.Run("fallback message", func(t *testing.T) {
		fresh, err := helper.DashboardsV1.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
		require.NoError(t, err)

		annotations := fresh.GetAnnotations()
		delete(annotations, utils.AnnoKeyMessage)
		fresh.SetAnnotations(annotations)
		require.NoError(t, unstructured.SetNestedField(fresh.Object, "Updated (fallback)", "spec", "title"))

		_, err = helper.DashboardsV1.Resource.Update(ctx, fresh, metav1.UpdateOptions{})
		require.NoError(t, err, "PUT must not fail with empty commit message")

		require.Equal(t, "Update "+dashboardUID, latestCommitSubject(t, local))
	})

	t.Run("annotation message", func(t *testing.T) {
		const msg = "Updated dashboard from integration test"
		fresh, err := helper.DashboardsV1.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
		require.NoError(t, err)

		annotations := fresh.GetAnnotations()
		if annotations == nil {
			annotations = map[string]string{}
		}
		annotations[utils.AnnoKeyMessage] = msg
		fresh.SetAnnotations(annotations)
		require.NoError(t, unstructured.SetNestedField(fresh.Object, "Updated (annotated)", "spec", "title"))

		_, err = helper.DashboardsV1.Resource.Update(ctx, fresh, metav1.UpdateOptions{})
		require.NoError(t, err)

		require.Equal(t, msg, latestCommitSubject(t, local))
	})
}

func TestIntegrationGit_ManagedDashboardCreate_CommitMessage(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()
	dashboardAPIVersion := dashboardV1.DashboardResourceInfo.GroupVersion().String()

	const repoName = "managed-msg-create"

	local := createSyncEnabledGitRepo(t, helper, repoName, nil)
	helper.SyncAndWait(t, repoName)

	t.Run("annotation message", func(t *testing.T) {
		const (
			newUID = "msg-create-annotated"
			newFn  = "created-annotated.json"
			msg    = "Create dashboard with custom message"
		)
		dash := newManagedDashboard(dashboardAPIVersion, newUID, repoName, newFn, msg)

		_, err := helper.DashboardsV1.Resource.Create(ctx, dash, metav1.CreateOptions{})
		require.NoError(t, err, "POST must not fail with empty commit message")

		require.Equal(t, msg, latestCommitSubject(t, local))
	})

	t.Run("fallback message", func(t *testing.T) {
		const (
			newUID = "msg-create-fallback"
			newFn  = "created-fallback.json"
		)
		dash := newManagedDashboard(dashboardAPIVersion, newUID, repoName, newFn, "")

		_, err := helper.DashboardsV1.Resource.Create(ctx, dash, metav1.CreateOptions{})
		require.NoError(t, err, "POST must not fail with empty commit message")

		require.Equal(t, "Create "+newUID, latestCommitSubject(t, local))
	})
}

func TestIntegrationGit_ManagedDashboardDelete_CommitMessage(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const (
		repoName     = "managed-msg-delete"
		dashboardUID = "msg-delete-dash"
		dashboardFn  = "dashboard.json"
	)

	local := createSyncEnabledGitRepo(t, helper, repoName, map[string][]byte{
		dashboardFn: common.DashboardJSON(dashboardUID, "Managed Dashboard", 1),
	})
	helper.SyncAndWait(t, repoName)
	waitForRepoManagedDashboard(t, helper, dashboardUID, repoName, dashboardFn)

	require.NoError(t, helper.DashboardsV1.Resource.Delete(ctx, dashboardUID, metav1.DeleteOptions{}),
		"DELETE must not fail with empty commit message")

	require.Equal(t, "Delete "+dashboardUID, latestCommitSubject(t, local))
}

// waitForRepoManagedDashboard blocks until the named dashboard has been
// synced into unified storage and is annotated as managed by the given repo.
func waitForRepoManagedDashboard(t *testing.T, h *common.GitTestHelper, dashboardUID, repoName, sourcePath string) {
	t.Helper()
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		dash, err := h.DashboardsV1.Resource.Get(context.Background(), dashboardUID, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		annotations := dash.GetAnnotations()
		assert.Equal(collect, string(utils.ManagerKindRepo), annotations[utils.AnnoKeyManagerKind])
		assert.Equal(collect, repoName, annotations[utils.AnnoKeyManagerIdentity])
		assert.Equal(collect, sourcePath, annotations[utils.AnnoKeySourcePath])
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "dashboard should be managed by repo")
}

// newManagedDashboard builds an unstructured Dashboard with the manager
// annotations needed to route a Dashboard API write through
// handleManagedResourceRouting. If message is empty, no message annotation is
// set so callers can exercise the action-specific fallback.
func newManagedDashboard(apiVersion, name, repoName, sourcePath, message string) *unstructured.Unstructured {
	annotations := map[string]interface{}{
		utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
		utils.AnnoKeyManagerIdentity: repoName,
		utils.AnnoKeySourcePath:      sourcePath,
	}
	if message != "" {
		annotations[utils.AnnoKeyMessage] = message
	}
	return &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": apiVersion,
			"kind":       "Dashboard",
			"metadata": map[string]interface{}{
				"name":        name,
				"annotations": annotations,
			},
			"spec": map[string]interface{}{
				"title":         name,
				"schemaVersion": 41,
			},
		},
	}
}

// createSyncEnabledGitRepo provisions a git-backed repository with sync
// enabled. Sync must be on for the provisioning files endpoint to dual-write
// new resources into unified storage; without it Dashboard API Create would
// fail at the post-write Get with KeyNotFound.
func createSyncEnabledGitRepo(t *testing.T, h *common.GitTestHelper, repoName string, initialFiles map[string][]byte) *gittest.LocalRepo {
	t.Helper()
	ctx := context.Background()

	user, err := h.GitServer().CreateUser(ctx)
	require.NoError(t, err)

	remote, err := h.GitServer().CreateRepo(ctx, repoName, user)
	require.NoError(t, err)

	local, err := gittest.NewLocalRepo(ctx)
	require.NoError(t, err)
	t.Cleanup(func() {
		if err := local.Cleanup(); err != nil {
			t.Logf("failed to cleanup local repo: %v", err)
		}
	})

	_, err = local.InitWithRemote(user, remote)
	require.NoError(t, err)

	for filePath, content := range initialFiles {
		require.NoError(t, local.CreateFile(filePath, string(content)))
	}
	if len(initialFiles) > 0 {
		_, err = local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "initial commit")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)
	}

	repoObj := h.RenderObject(t, common.TestdataPath("git.json.tmpl"), map[string]any{
		"Name":          repoName,
		"Title":         fmt.Sprintf("Test Repository %s", repoName),
		"URL":           remote.URL,
		"Branch":        "main",
		"TokenUser":     user.Username,
		"Token":         user.Password,
		"SyncEnabled":   true,
		"SyncTarget":    "instance",
		"WorkflowsJSON": `["write"]`,
	})

	_, err = h.Repositories.Resource.Create(ctx, repoObj, metav1.CreateOptions{})
	require.NoError(t, err)
	h.WaitForHealthyRepository(t, repoName)

	return local
}

// latestCommitSubject fetches origin/main and returns the subject line of the
// HEAD commit on that branch.
func latestCommitSubject(t *testing.T, local *gittest.LocalRepo) string {
	t.Helper()
	_, err := local.Git("fetch", "origin", "main")
	require.NoError(t, err, "git fetch origin main should succeed")
	out, err := local.Git("log", "-1", "--format=%s", "origin/main")
	require.NoError(t, err, "git log should succeed")
	return strings.TrimSpace(out)
}

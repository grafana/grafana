package git

import (
	"context"
	"strings"
	"testing"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/nanogit/gittest"
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
// proxied write reflects into unified storage (otherwise the post-write Get
// inside handleManagedResourceRouting would fail with KeyNotFound on Create).
// The tests assert two things:
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

	_, local := helper.CreateSyncEnabledGitRepo(t, repoName, map[string][]byte{
		dashboardFn: common.DashboardJSON(dashboardUID, "Managed Dashboard", 1),
	})
	helper.SyncAndWait(t, repoName)
	common.RequireRepoManagedDashboard(t, helper.DashboardsV1, ctx, dashboardUID, repoName, dashboardFn)

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

	_, local := helper.CreateSyncEnabledGitRepo(t, repoName, nil)
	helper.SyncAndWait(t, repoName)

	t.Run("annotation message", func(t *testing.T) {
		const (
			newUID = "msg-create-annotated"
			newFn  = "created-annotated.json"
			msg    = "Create dashboard with custom message"
		)
		dash := common.NewManagedDashboard(dashboardAPIVersion, newUID, repoName, newFn, msg)

		_, err := helper.DashboardsV1.Resource.Create(ctx, dash, metav1.CreateOptions{})
		require.NoError(t, err, "POST must not fail with empty commit message")

		require.Equal(t, msg, latestCommitSubject(t, local))
	})

	t.Run("fallback message", func(t *testing.T) {
		const (
			newUID = "msg-create-fallback"
			newFn  = "created-fallback.json"
		)
		dash := common.NewManagedDashboard(dashboardAPIVersion, newUID, repoName, newFn, "")

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

	_, local := helper.CreateSyncEnabledGitRepo(t, repoName, map[string][]byte{
		dashboardFn: common.DashboardJSON(dashboardUID, "Managed Dashboard", 1),
	})
	helper.SyncAndWait(t, repoName)
	common.RequireRepoManagedDashboard(t, helper.DashboardsV1, ctx, dashboardUID, repoName, dashboardFn)

	require.NoError(t, helper.DashboardsV1.Resource.Delete(ctx, dashboardUID, metav1.DeleteOptions{}),
		"DELETE must not fail with empty commit message")

	require.Equal(t, "Delete "+dashboardUID, latestCommitSubject(t, local))
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

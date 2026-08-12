package git

import (
	"strings"
	"testing"

	"github.com/grafana/nanogit/gittest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_IncrementalGitSync_ManagedByOtherFileWarning
// exercises the deleteOldResource skip-delete guard: a replace that would delete
// a UID now legitimately owned by a DIFFERENT file is skipped and surfaced as a
// "skipping delete of old resource" warning instead of failing the sync (or
// orphaning the resource the other file now owns).
//
// It must be reached through an INTENTIONAL UID takeover, not an accidental
// cross-file duplicate: the latter is now blocked at write time by the cross-file
// duplicate guard. Incremental sync processes files sequentially in alphabetical
// order, so within a single sync:
//
//	c1: dir-a = uid-a, dir-b = uid-b
//	c2: dir-a: uid-a → uid-b   (takes over uid-b, which dir-b is releasing)
//	    dir-b: uid-b → uid-new (moves to a fresh UID)
//	      1. dir-a runs first: writes uid-b (dir-b already declares uid-new at this
//	         ref, so the write is a legitimate takeover, not a duplicate) → uid-b's
//	         sourcePath flips to dir-a; then deletes uid-a (still owned by dir-a).
//	      2. dir-b runs next: writes uid-new, then tries to delete uid-b — now owned
//	         by dir-a — which is skipped and surfaced as the managed-by-other warning.
func TestIntegrationProvisioning_IncrementalGitSync_ManagedByOtherFileWarning(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "git-incremental-managed-by-other"

	// c1: dir-a owns uid-a, dir-b owns uid-b.
	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dir-a/dashboard.json": common.DashboardJSON("uid-a", "Dashboard A", 1),
		"dir-b/dashboard.json": common.DashboardJSON("uid-b", "Dashboard B", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	require.Equal(t, "dir-a/dashboard.json", dashboardSourcePath(t, helper, "uid-a"),
		"after c1, uid-a must be owned by dir-a")
	require.Equal(t, "dir-b/dashboard.json", dashboardSourcePath(t, helper, "uid-b"),
		"after c1, uid-b must be owned by dir-b")

	// c2 (single incremental sync): dir-a takes uid-b while dir-b moves to uid-new.
	require.NoError(t, local.UpdateFile("dir-a/dashboard.json", string(common.DashboardJSON("uid-b", "Dashboard A takes B", 2))))
	require.NoError(t, local.UpdateFile("dir-b/dashboard.json", string(common.DashboardJSON("uid-new", "Dashboard B moved", 2))))
	gitCommitPush(t, local, "dir-a takes uid-b, dir-b moves to uid-new")

	common.SyncAndWait(t, helper, common.Repo(repoName),
		common.Incremental,
		common.Warning(),
		common.Expect(hasWarningContaining("skipping delete of old resource")),
	)

	// uid-b was taken over by dir-a; dir-b owns its new uid; uid-a was deleted.
	require.Equal(t, "dir-a/dashboard.json", dashboardSourcePath(t, helper, "uid-b"),
		"uid-b must be taken over by dir-a")
	require.Equal(t, "dir-b/dashboard.json", dashboardSourcePath(t, helper, "uid-new"),
		"dir-b must own its new uid")

	// Exactly the two surviving dashboards remain (uid-b, uid-new); uid-a is gone.
	helper.RequireRepoDashboardCount(t, repoName, 2)
}

// dashboardSourcePath returns the grafana.app/sourcePath annotation of the
// dashboard with the given UID, polling until it is retrievable.
func dashboardSourcePath(t *testing.T, helper *common.GitTestHelper, uid string) string {
	t.Helper()
	var sourcePath string
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		obj, err := helper.DashboardsV1.Resource.Get(t.Context(), uid, metav1.GetOptions{})
		require.NoError(c, err, "failed to get dashboard %s", uid)

		sp := obj.GetAnnotations()["grafana.app/sourcePath"]
		assert.NotEmpty(c, sp, "dashboard %q should have sourcePath annotation", uid)
		sourcePath = sp
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "dashboard %q should be retrievable", uid)
	return sourcePath
}

// gitCommitPush stages, commits, and pushes the current working tree.
func gitCommitPush(t *testing.T, local *gittest.LocalRepo, message string) {
	t.Helper()
	_, err := local.Git("add", ".")
	require.NoError(t, err, "git add")
	_, err = local.Git("commit", "-m", message)
	require.NoError(t, err, "git commit")
	_, err = local.Git("push")
	require.NoError(t, err, "git push")
}

// hasWarningContaining asserts at least one job warning contains substr.
func hasWarningContaining(substr string) common.JobMatcher {
	return func(t *testing.T, job *unstructured.Unstructured) {
		t.Helper()
		warnings := common.MustNestedStringSlice(job.Object, "status", "warnings")
		for _, w := range warnings {
			if strings.Contains(w, substr) {
				return
			}
		}
		require.Failf(t, "missing expected warning",
			"expected a warning containing %q; got warnings=%v", substr, warnings)
	}
}

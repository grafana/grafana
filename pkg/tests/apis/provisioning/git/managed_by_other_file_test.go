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
// reproduces the customer scenario where a dashboard UID is reused across files.
//
// Only incremental sync reaches this path: a modified file goes through
// ReplaceResourceFromFileByRef, which derives the old UID from the file's
// previous git ref and, after writing the new resource, deletes that old UID to
// avoid orphans. When the old UID is now owned by a different file, the delete
// is skipped and surfaced as a warning instead of failing the sync.
//
// The takeover must be persisted in an earlier sync than the replace, otherwise
// the create and the replace collapse into one order-dependent pass. Hence the
// three separate syncs below:
//
//	c1: dir-a = shared-uid            → resource shared-uid owned by dir-a
//	c2: add dir-b = shared-uid        → upsert of the same resource; now owned by dir-b
//	c3: dir-a: shared-uid → new-uid   → replace writes new-uid, skips deleting
//	                                    shared-uid (owned by dir-b) → warning
func TestIntegrationProvisioning_IncrementalGitSync_ManagedByOtherFileWarning(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "git-incremental-managed-by-other"

	// c1: only dir-a exists, owning "shared-uid".
	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dir-a/dashboard.json": common.DashboardJSON("shared-uid", "Dashboard A", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	require.Equal(t, "dir-a/dashboard.json",
		dashboardSourcePath(t, helper, "shared-uid"),
		"after c1, shared-uid must be owned by dir-a")

	// c2: add dir-b with the SAME UID. In its own incremental sync this is an
	// upsert of the single shared-uid resource (K8s keys by name, same-repo
	// manager passes the ownership check), so it succeeds and flips ownership to
	// dir-b. The cross-file duplicate guard is per-sync/in-memory, so it does not
	// fire here — dir-a is not part of this diff.
	require.NoError(t, local.CreateFile("dir-b/dashboard.json", string(common.DashboardJSON("shared-uid", "Dashboard B", 1))))
	gitCommitPush(t, local, "add dir-b with duplicate uid")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())
	require.Equal(t, "dir-b/dashboard.json",
		dashboardSourcePath(t, helper, "shared-uid"),
		"after c2, shared-uid ownership must have flipped to dir-b")

	// c3: change dir-a's UID. The replace writes new-uid, then tries to delete
	// the old shared-uid — now owned by dir-b — and skips it, surfacing the
	// "skipping delete of old resource" warning without failing the sync.
	require.NoError(t, local.UpdateFile("dir-a/dashboard.json", string(common.DashboardJSON("new-uid", "Dashboard A v2", 2))))
	gitCommitPush(t, local, "change dir-a uid to new-uid")

	common.SyncAndWait(t, helper, common.Repo(repoName),
		common.Incremental,
		common.Warning(),
		common.Expect(hasWarningContaining("skipping delete of old resource")),
	)

	// dir-a's new resource must exist.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(t.Context(), "new-uid", metav1.GetOptions{})
		assert.NoError(c, err, "new-uid dashboard should exist")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "new-uid should be created")

	// The old UID must NOT have been deleted — it is legitimately owned by dir-b.
	require.Equal(t, "dir-b/dashboard.json",
		dashboardSourcePath(t, helper, "shared-uid"),
		"shared-uid must survive the replace, still owned by dir-b")

	// Exactly the two distinct dashboards remain.
	helper.RequireRepoDashboardCount(t, repoName, 2)
}

// dashboardSourcePath returns the grafana.app/sourcePath annotation of the
// dashboard with the given UID, polling until it is retrievable.
func dashboardSourcePath(t *testing.T, helper *common.GitTestHelper, uid string) string {
	t.Helper()
	var sourcePath string
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		obj, err := helper.DashboardsV1.Resource.Get(t.Context(), uid, metav1.GetOptions{})
		if !assert.NoError(c, err, "failed to get dashboard %s", uid) {
			return
		}
		sourcePath = obj.GetAnnotations()["grafana.app/sourcePath"]
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

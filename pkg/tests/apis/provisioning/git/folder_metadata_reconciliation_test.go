package git

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/util/retry"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_FullSync_MetadataDeletionPreservesFallbackUID(t *testing.T) {
	helper := sharedGitHelper(t)
	const repoName = "full-meta-fallback"
	uid := resources.ParseFolder("team/", repoName).ID
	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"team/_folder.json": common.FolderBody(t, uid, "Custom Title"),
		"team/.keep":        {},
	})
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireFolderState(t, helper.Folders, uid, "Custom Title", "team", "")
	before, err := helper.Folders.Resource.Get(t.Context(), uid, metav1.GetOptions{})
	require.NoError(t, err)
	_, err = local.Git("rm", "team/_folder.json")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "remove metadata while retaining empty folder")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWait(t, helper, common.Repo(repoName),
		common.Expect(common.HasNoErrors(), common.HasState(provisioning.JobStateWarning)))
	common.RequireFolderState(t, helper.Folders, uid, "team", "team", "")
	after, err := helper.Folders.Resource.Get(t.Context(), uid, metav1.GetOptions{})
	require.NoError(t, err)
	common.RequireUpdatedInPlace(t, "empty folder", common.SnapshotObject(t, before), common.SnapshotObject(t, after))
	require.Empty(t, after.GetAnnotations()["grafana.app/sourceChecksum"])
	helper.RequireRepoFolderCount(t, repoName, 1)
}

func TestIntegrationProvisioning_IncrementalSync_ReconcilesLegacyFolderMetadata(t *testing.T) {
	for _, scenario := range []string{"same-ref", "empty-diff", "dashboard-edit"} {
		t.Run(scenario, func(t *testing.T) {
			helper := sharedGitHelper(t)
			repoName := "legacy-meta-" + scenario
			_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
				"team/dashboard.json": common.DashboardJSON("legacy-dash", "Dashboard", 1),
				"unrelated.json":      common.DashboardJSON("unrelated-dash", "Unrelated", 1),
			})
			common.SyncAndWait(t, helper, common.Repo(repoName), common.Expect(common.HasNoErrors(), common.HasState(provisioning.JobStateWarning)))
			oldUID := resources.ParseFolder("team/", repoName).ID
			common.RequireFolderState(t, helper.Folders, oldUID, "team", "team", "")
			paths := []string{"team/dashboard.json"}
			before := common.SnapshotDashboardsBySourcePath(t, helper.ProvisioningTestHelper, repoName, paths)

			require.NoError(t, local.CreateFile("team/_folder.json", string(common.FolderBody(t, "stable-team", "Team Display Name"))))
			_, err := local.Git("add", ".")
			require.NoError(t, err)
			_, err = local.Git("commit", "-m", "add folder manifest")
			require.NoError(t, err)
			_, err = local.Git("push")
			require.NoError(t, err)
			ref, err := local.Git("rev-parse", "HEAD")
			require.NoError(t, err)

			// Model a backend that already synced this commit with metadata disabled:
			// lastRef includes the manifest, but live resources still use the fallback UID.
			require.NoError(t, retry.RetryOnConflict(retry.DefaultRetry, func() error {
				repo, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
				if err != nil {
					return err
				}
				if err := unstructured.SetNestedField(repo.Object, strings.TrimSpace(ref), "status", "sync", "lastRef"); err != nil {
					return err
				}
				_, err = helper.Repositories.Resource.UpdateStatus(t.Context(), repo, metav1.UpdateOptions{})
				return err
			}))
			unrelatedTitle := "Unrelated"
			switch scenario {
			case "empty-diff":
				_, err = local.Git("commit", "--allow-empty", "-m", "advance without changing files")
				require.NoError(t, err)
			case "dashboard-edit":
				unrelatedTitle = "Edited"
				require.NoError(t, local.UpdateFile("unrelated.json", string(common.DashboardJSON("unrelated-dash", "Edited", 2))))
				_, err = local.Git("add", ".")
				require.NoError(t, err)
				_, err = local.Git("commit", "-m", "edit unrelated dashboard")
				require.NoError(t, err)
			}
			_, err = local.Git("push")
			require.NoError(t, err)

			job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
				Action: provisioning.JobActionPull,
				Pull:   &provisioning.SyncJobOptions{Incremental: true},
			})
			jobObj := common.MustFromUnstructured[provisioning.Job](t, job)
			require.Equal(t, provisioning.JobStateSuccess, jobObj.Status.State)
			require.Empty(t, jobObj.Status.Errors)
			require.Empty(t, jobObj.Status.Warnings)
			common.RequireFolderState(t, helper.Folders, "stable-team", "Team Display Name", "team", "")
			helper.RequireFoldersNotFound(t, oldUID)
			common.RequireDashboards(t, helper.DashboardsV1, map[string]common.ExpectedDashboard{
				"legacy-dash":    {Title: "Dashboard", SourcePath: "team/dashboard.json", Folder: "stable-team"},
				"unrelated-dash": {Title: unrelatedTitle, SourcePath: "unrelated.json"},
			})
			after := common.SnapshotDashboardsBySourcePath(t, helper.ProvisioningTestHelper, repoName, paths)
			common.RequireDashboardsUpdatedInPlace(t, before, after, paths)
			helper.RequireRepoFolderCount(t, repoName, 1)
		})
	}
}

func TestIntegrationProvisioning_IncrementalSync_RootMetadataPreservesWrapper(t *testing.T) {
	helper := sharedGitHelper(t)
	const repoName = "root-meta-wrapper"
	_, local := helper.CreateFolderTargetGitRepo(t, repoName, map[string][]byte{
		"dashboard.json":    common.DashboardJSON("root-dash", "Dashboard", 1),
		"team/_folder.json": common.FolderBody(t, "nested-team", "Team"),
		"team/.keep":        {},
	})
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	wrapper, err := helper.Folders.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
	require.NoError(t, err)
	before := common.SnapshotObject(t, wrapper)

	for _, action := range []string{"create", "update", "delete", "rename-to-root", "rename-from-root"} {
		t.Run(action, func(t *testing.T) {
			switch action {
			case "create":
				require.NoError(t, local.CreateFile("_folder.json", string(common.FolderBody(t, "root-manifest", "Root"))))
			case "update":
				require.NoError(t, local.UpdateFile("_folder.json", string(common.FolderBody(t, "other-root", "Other Root"))))
			case "delete":
				_, err = local.Git("rm", "_folder.json")
				require.NoError(t, err)
			case "rename-to-root":
				_, err = local.Git("mv", "team/_folder.json", "_folder.json")
				require.NoError(t, err)
			case "rename-from-root":
				_, err = local.Git("mv", "_folder.json", "team/_folder.json")
				require.NoError(t, err)
			}
			_, err = local.Git("add", ".")
			require.NoError(t, err)
			_, err = local.Git("commit", "-m", action)
			require.NoError(t, err)
			_, err = local.Git("push")
			require.NoError(t, err)
			state := provisioning.JobStateSuccess
			nestedUID, nestedTitle := "nested-team", "Team"
			if action == "rename-to-root" {
				state = provisioning.JobStateWarning
				nestedUID, nestedTitle = resources.ParseFolder("team/", repoName).ID, "team"
			}
			common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Expect(common.HasNoErrors(), common.HasState(state)))
			wrapper, err := helper.Folders.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
			require.NoError(t, err)
			common.RequireUpdatedInPlace(t, "repository wrapper", before, common.SnapshotObject(t, wrapper))
			common.RequireFolderState(t, helper.Folders, nestedUID, nestedTitle, "team", repoName)
			common.RequireDashboards(t, helper.DashboardsV1, map[string]common.ExpectedDashboard{
				"root-dash": {Title: "Dashboard", SourcePath: "dashboard.json", Folder: repoName},
			})
			helper.RequireRepoFolderCount(t, repoName, 2)
		})
	}
}

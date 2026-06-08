package jobs

import (
	"context"
	"net/http"
	"path"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// UIDs baked into the shared testdata fixtures.
const (
	allPanelsUID = "n1jR8vnnz" // ../testdata/all-panels.json
	timelineUID  = "mIJjFy8Kz" // ../testdata/timeline-demo.json
)

// TestIntegrationProvisioning_FolderlessSyncPlacement verifies that a folderless
// repository places repo-root files at the top level (no wrapper folder named
// after the repository) and turns subdirectories into top-level folders.
func TestIntegrationProvisioning_FolderlessSyncPlacement(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "folderless-placement"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		LocalPath:  path.Join(helper.ProvisioningPath, repo),
		SyncTarget: "folderless",
		Copies: map[string]string{
			"../testdata/all-panels.json":    "root-dashboard.json",
			"../testdata/timeline-demo.json": "team-x/nested-dashboard.json",
		},
		ExpectedDashboards: 2, // both dashboards
		ExpectedFolders:    1, // only team-x; NO wrapper folder for the repo
	})

	// No wrapper folder named after the repository must be created.
	_, err := helper.Folders.Resource.Get(ctx, repo, metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err),
		"folderless must not create a wrapper folder named after the repository")

	// The single folder is the top-level folder derived from the subdirectory.
	folders, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, folders.Items, 1, "only the subdirectory should become a folder")
	subFolder := folders.Items[0]
	require.NotEqual(t, repo, subFolder.GetName(), "the folder must not be the repo wrapper folder")
	require.Empty(t, subFolder.GetAnnotations()[utils.AnnoKeyFolder],
		"the subdirectory folder must be at the top level (no parent)")
	require.Equal(t, repo, subFolder.GetAnnotations()[utils.AnnoKeyManagerIdentity],
		"the folder must be managed by the folderless repo")

	// Root-level dashboard must be top-level (no parent folder).
	rootDash, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
	require.NoError(t, err, "root dashboard should exist")
	require.Empty(t, rootDash.GetAnnotations()[utils.AnnoKeyFolder],
		"root-level dashboard must have no parent folder")
	require.Equal(t, repo, rootDash.GetAnnotations()[utils.AnnoKeyManagerIdentity])

	// Nested dashboard must live inside the top-level folder.
	nestedDash, err := helper.DashboardsV1.Resource.Get(ctx, timelineUID, metav1.GetOptions{})
	require.NoError(t, err, "nested dashboard should exist")
	require.Equal(t, subFolder.GetName(), nestedDash.GetAnnotations()[utils.AnnoKeyFolder],
		"nested dashboard must be parented to the top-level folder")
	require.Equal(t, repo, nestedDash.GetAnnotations()[utils.AnnoKeyManagerIdentity])
}

// TestIntegrationProvisioning_FolderlessCoexistence verifies that two folderless
// repositories — and unprovisioned content — coexist at the top level, and that
// syncing one repository never deletes another repo's or unprovisioned resources.
// This is the deletion-safety invariant for the per-repo ownership scope.
func TestIntegrationProvisioning_FolderlessCoexistence(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	// An unprovisioned dashboard created directly in Grafana.
	unmanaged := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
	createdUnmanaged, err := helper.DashboardsV1.Resource.Create(ctx, unmanaged, metav1.CreateOptions{})
	require.NoError(t, err, "should create an unprovisioned dashboard")
	unmanagedName := createdUnmanaged.GetName()

	const repo1 = "folderless-coexist-1"
	const repo2 = "folderless-coexist-2"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo1,
		LocalPath:  path.Join(helper.ProvisioningPath, repo1),
		SyncTarget: "folderless",
		Copies: map[string]string{
			"../testdata/all-panels.json": "dashboard1.json",
		},
		SkipResourceAssertions: true,
	})
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo2,
		LocalPath:  path.Join(helper.ProvisioningPath, repo2),
		SyncTarget: "folderless",
		Copies: map[string]string{
			"../testdata/timeline-demo.json": "dashboard2.json",
		},
		SkipResourceAssertions: true,
	})

	// Each repo owns its own dashboard; the unprovisioned one stays unmanaged.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		d1, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		assert.Equal(collect, repo1, d1.GetAnnotations()[utils.AnnoKeyManagerIdentity])

		d2, err := helper.DashboardsV1.Resource.Get(ctx, timelineUID, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		assert.Equal(collect, repo2, d2.GetAnnotations()[utils.AnnoKeyManagerIdentity])
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "both folderless repos should own their dashboards")

	// Sync repo1; repo2's dashboard and the unprovisioned dashboard must survive.
	repo2Before, err := helper.DashboardsV1.Resource.Get(ctx, timelineUID, metav1.GetOptions{})
	require.NoError(t, err)

	helper.SyncAndWait(t, repo1, nil)

	repo2After, err := helper.DashboardsV1.Resource.Get(ctx, timelineUID, metav1.GetOptions{})
	require.NoError(t, err, "repo2's dashboard must survive a repo1 sync")
	require.Equal(t, repo2, repo2After.GetAnnotations()[utils.AnnoKeyManagerIdentity])
	require.Equal(t, repo2Before.GetGeneration(), repo2After.GetGeneration(),
		"repo2's dashboard must not be modified by a repo1 sync")

	survivor, err := helper.DashboardsV1.Resource.Get(ctx, unmanagedName, metav1.GetOptions{})
	require.NoError(t, err, "unprovisioned dashboard must survive a folderless sync")
	require.Empty(t, survivor.GetAnnotations()[utils.AnnoKeyManagerIdentity],
		"unprovisioned dashboard must remain unmanaged")
}

// TestIntegrationProvisioning_FolderlessCoexistsWithFolderAndUnmanaged verifies
// that a folderless repository coexists with a folder-sync repository and with
// unprovisioned content: each owns only its own resources, the folder repo keeps
// its wrapper folder while the folderless repo creates none, and syncing the
// folderless repo leaves the others untouched.
func TestIntegrationProvisioning_FolderlessCoexistsWithFolderAndUnmanaged(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	// 1. Unprovisioned dashboard created directly in Grafana.
	unmanaged := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
	createdUnmanaged, err := helper.DashboardsV1.Resource.Create(ctx, unmanaged, metav1.CreateOptions{})
	require.NoError(t, err, "should create an unprovisioned dashboard")
	unmanagedName := createdUnmanaged.GetName()

	// 2. Folder-sync repository (creates a wrapper folder named after the repo).
	const folderRepo = "coexist-folder"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       folderRepo,
		LocalPath:  path.Join(helper.ProvisioningPath, folderRepo),
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json": "folder-dashboard.json",
		},
		SkipResourceAssertions: true,
	})

	// 3. Folderless repository (top level, no wrapper folder).
	const folderlessRepo = "coexist-folderless"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       folderlessRepo,
		LocalPath:  path.Join(helper.ProvisioningPath, folderlessRepo),
		SyncTarget: "folderless",
		Copies: map[string]string{
			"../testdata/timeline-demo.json": "folderless-dashboard.json",
		},
		SkipResourceAssertions: true,
	})

	// Each repository owns only its own dashboard; the unprovisioned one stays unmanaged.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		fd, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		assert.Equal(collect, folderRepo, fd.GetAnnotations()[utils.AnnoKeyManagerIdentity])
		// A folder-sync root file lives inside the repo's wrapper folder.
		assert.Equal(collect, folderRepo, fd.GetAnnotations()[utils.AnnoKeyFolder])

		fld, err := helper.DashboardsV1.Resource.Get(ctx, timelineUID, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		assert.Equal(collect, folderlessRepo, fld.GetAnnotations()[utils.AnnoKeyManagerIdentity])
		// A folderless root file is at the top level.
		assert.Empty(collect, fld.GetAnnotations()[utils.AnnoKeyFolder])

		um, err := helper.DashboardsV1.Resource.Get(ctx, unmanagedName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		assert.Empty(collect, um.GetAnnotations()[utils.AnnoKeyManagerIdentity])
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "all three should coexist with correct ownership")

	// The folder repo has a wrapper folder; the folderless repo has none.
	_, err = helper.Folders.Resource.Get(ctx, folderRepo, metav1.GetOptions{})
	require.NoError(t, err, "folder-sync repo should have a wrapper folder")
	_, err = helper.Folders.Resource.Get(ctx, folderlessRepo, metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "folderless repo must not create a wrapper folder")

	// Capture state before syncing the folderless repo.
	folderDashBefore, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
	require.NoError(t, err)
	unmanagedBefore, err := helper.DashboardsV1.Resource.Get(ctx, unmanagedName, metav1.GetOptions{})
	require.NoError(t, err)

	// Syncing the folderless repo must not touch the folder repo's or unprovisioned resources.
	helper.SyncAndWait(t, folderlessRepo, nil)

	folderDashAfter, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
	require.NoError(t, err, "folder repo's dashboard must survive a folderless sync")
	require.Equal(t, folderRepo, folderDashAfter.GetAnnotations()[utils.AnnoKeyManagerIdentity],
		"folder repo's dashboard must keep its owner")
	require.Equal(t, folderDashBefore.GetGeneration(), folderDashAfter.GetGeneration(),
		"folder repo's dashboard must not be modified by a folderless sync")

	unmanagedAfter, err := helper.DashboardsV1.Resource.Get(ctx, unmanagedName, metav1.GetOptions{})
	require.NoError(t, err, "unprovisioned dashboard must survive a folderless sync")
	require.Empty(t, unmanagedAfter.GetAnnotations()[utils.AnnoKeyManagerIdentity],
		"unprovisioned dashboard must remain unmanaged")
	require.Equal(t, unmanagedBefore.GetGeneration(), unmanagedAfter.GetGeneration(),
		"unprovisioned dashboard must not be modified by a folderless sync")
}

// TestIntegrationProvisioning_FolderlessMigrate verifies the migrate flow for a
// folderless repository: unprovisioned dashboards are exported to the repo and
// taken over (managed) at the top level, with no wrapper folder, and without
// cleaning the namespace.
func TestIntegrationProvisioning_FolderlessMigrate(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	// Two unprovisioned dashboards to migrate.
	dash1 := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
	created1, err := helper.DashboardsV1.Resource.Create(ctx, dash1, metav1.CreateOptions{})
	require.NoError(t, err)
	name1 := created1.GetName()

	dash2 := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v2beta1.yaml")
	created2, err := helper.DashboardsV2beta1.Resource.Create(ctx, dash2, metav1.CreateOptions{})
	require.NoError(t, err)
	name2 := created2.GetName()

	const repo = "folderless-migrate"
	repoPath := filepath.Join(helper.ProvisioningPath, repo)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:               repo,
		LocalPath:          repoPath,
		SyncTarget:         "folderless",
		Workflows:          []string{"write"},
		ExpectedDashboards: 2, // the two unprovisioned dashboards (not yet managed)
		ExpectedFolders:    0, // no wrapper folder
	})

	helper.TriggerJobAndWaitForSuccess(t, repo, provisioning.JobSpec{
		Action:  provisioning.JobActionMigrate,
		Migrate: &provisioning.MigrateJobOptions{Message: "migrate to folderless"},
	})

	// Both dashboards are now managed by the repo and remain at the top level.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		for _, name := range []string{name1, name2} {
			d, err := helper.DashboardsV1.Resource.Get(ctx, name, metav1.GetOptions{})
			if !assert.NoError(collect, err) {
				return
			}
			assert.Equal(collect, repo, d.GetAnnotations()[utils.AnnoKeyManagerIdentity],
				"dashboard %s should be managed after migration", name)
			assert.Empty(collect, d.GetAnnotations()[utils.AnnoKeyFolder],
				"migrated dashboard %s should be at the top level", name)
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "dashboards should be managed at the top level")

	// No wrapper folder must be created by the migration.
	_, err = helper.Folders.Resource.Get(ctx, repo, metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "folderless migrate must not create a wrapper folder")

	// The export phase wrote the managed dashboards into the repository.
	fileCount, err := common.CountFilesInDir(repoPath)
	require.NoError(t, err)
	require.Equal(t, 2, fileCount, "both dashboards should be exported to the repo at the top level")
}

// TestIntegrationProvisioning_FolderlessFileCreate verifies that creating files
// via the files endpoint maps a repo-root file to a top-level resource and a
// file in a subdirectory to a resource inside a top-level folder, with no
// wrapper folder for the repository.
func TestIntegrationProvisioning_FolderlessFileCreate(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "folderless-create"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		LocalPath:              path.Join(helper.ProvisioningPath, repo),
		SyncTarget:             "folderless",
		Workflows:              []string{"write"},
		SkipResourceAssertions: true,
	})

	files := helper.NewFilesClient(repo)

	rootDashboard := []byte(`{
		"apiVersion": "dashboard.grafana.app/v0alpha1",
		"kind": "Dashboard",
		"metadata": {"name": "fldless-root"},
		"spec": {"title": "Folderless Root Dashboard"}
	}`)
	subDashboard := []byte(`{
		"apiVersion": "dashboard.grafana.app/v0alpha1",
		"kind": "Dashboard",
		"metadata": {"name": "fldless-sub"},
		"spec": {"title": "Folderless Sub Dashboard"}
	}`)

	// Create a dashboard at the repository root -> top-level resource.
	// Creation is POST with a body (PUT is reserved for updates).
	resp := files.Do(t, http.MethodPost, "root-dashboard.json", rootDashboard)
	require.Equal(t, http.StatusOK, resp.StatusCode, "creating a root file should succeed: %s", resp.BodyString())

	// Create a dashboard in a subdirectory -> resource inside a top-level folder.
	resp = files.Do(t, http.MethodPost, "team-z/sub-dashboard.json", subDashboard)
	require.Equal(t, http.StatusOK, resp.StatusCode, "creating a file in a subdirectory should succeed: %s", resp.BodyString())

	// No wrapper folder named after the repository.
	_, err := helper.Folders.Resource.Get(ctx, repo, metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "folderless must not create a wrapper folder")

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		root, err := helper.DashboardsV1.Resource.Get(ctx, "fldless-root", metav1.GetOptions{})
		if !assert.NoError(collect, err, "root dashboard should exist") {
			return
		}
		assert.Equal(collect, repo, root.GetAnnotations()[utils.AnnoKeyManagerIdentity])
		assert.Empty(collect, root.GetAnnotations()[utils.AnnoKeyFolder],
			"root file must map to a top-level resource")

		sub, err := helper.DashboardsV1.Resource.Get(ctx, "fldless-sub", metav1.GetOptions{})
		if !assert.NoError(collect, err, "subdirectory dashboard should exist") {
			return
		}
		assert.Equal(collect, repo, sub.GetAnnotations()[utils.AnnoKeyManagerIdentity])
		parent := sub.GetAnnotations()[utils.AnnoKeyFolder]
		if !assert.NotEmpty(collect, parent, "subdirectory file must map into a folder") {
			return
		}
		assert.NotEqual(collect, repo, parent, "the parent folder must not be a repo wrapper folder")

		// The parent folder must itself be top-level (no grandparent).
		parentFolder, err := helper.Folders.Resource.Get(ctx, parent, metav1.GetOptions{})
		if !assert.NoError(collect, err, "parent folder should exist") {
			return
		}
		assert.Empty(collect, parentFolder.GetAnnotations()[utils.AnnoKeyFolder],
			"the subdirectory folder must be at the top level")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "created resources should map to top level / top-level folder")
}

// TestIntegrationProvisioning_FolderlessFileMove verifies that moving a file
// between the repository root and a subdirectory reparents the resource to and
// from the top level for a folderless repository.
func TestIntegrationProvisioning_FolderlessFileMove(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "folderless-files"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		LocalPath:  path.Join(helper.ProvisioningPath, repo),
		SyncTarget: "folderless",
		Workflows:  []string{"write"},
		Copies: map[string]string{
			"../testdata/all-panels.json": "dashboard.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    0, // top-level resource, no folders yet
	})

	// Initially top-level: no parent folder.
	dash, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
	require.NoError(t, err)
	require.Empty(t, dash.GetAnnotations()[utils.AnnoKeyFolder], "dashboard should start at the top level")

	// Move root -> subdirectory (reparent into a top-level folder).
	resp := helper.PostFilesRequest(t, repo, common.FilesPostOptions{
		TargetPath:   "team-y/dashboard.json",
		OriginalPath: "dashboard.json",
		Message:      "move dashboard into a subfolder",
	})
	_ = resp.Body.Close()
	require.Equal(t, 200, resp.StatusCode, "move into subfolder should succeed")

	_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "team-y", "dashboard.json")
	require.NoError(t, err, "file should exist at the new subdirectory path")
	_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "dashboard.json")
	require.Error(t, err, "file should no longer exist at the repo root")

	// The dashboard is reparented into the (now top-level) subfolder.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		moved, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		assert.NotEmpty(collect, moved.GetAnnotations()[utils.AnnoKeyFolder],
			"dashboard should be parented to the subfolder after the move")
		assert.Equal(collect, repo, moved.GetAnnotations()[utils.AnnoKeyManagerIdentity])
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "dashboard should be reparented into the subfolder")

	// Move subdirectory -> root (reparent back to the top level).
	resp = helper.PostFilesRequest(t, repo, common.FilesPostOptions{
		TargetPath:   "dashboard.json",
		OriginalPath: "team-y/dashboard.json",
		Message:      "move dashboard back to the top level",
	})
	_ = resp.Body.Close()
	require.Equal(t, 200, resp.StatusCode, "move back to root should succeed")

	_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "dashboard.json")
	require.NoError(t, err, "file should exist back at the repo root")

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		back, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		assert.Empty(collect, back.GetAnnotations()[utils.AnnoKeyFolder],
			"dashboard should be back at the top level after moving to root")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "dashboard should return to the top level")
}

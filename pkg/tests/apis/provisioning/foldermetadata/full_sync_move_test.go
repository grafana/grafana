package foldermetadata

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_FullSync_FolderMoveWithMetadata(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
	const repo = "folder-move-metadata"

	writeToProvisioningPath(t, helper, "teamA/_folder.json", folderMetadataJSON("team-a-uid", "Team A Display"))
	writeToProvisioningPath(t, helper, "teamB/_folder.json", folderMetadataJSON("team-b-uid", "Team B Display"))
	writeToProvisioningPath(t, helper, "teamC/teamD/.keep", []byte{})

	helper.CreateRepo(t, common.TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json":    "teamA/dashboard.json",
			"../testdata/text-options.json":  "teamB/dashboard.json",
			"../testdata/timeline-demo.json": "teamC/dashboard.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "team-a-uid", "Team A Display", "teamA", repo)
	requireFolderState(t, helper, "team-b-uid", "Team B Display", "teamB", repo)

	teamCUID := findFolderUIDBySourcePath(t, helper, repo, "teamC")
	teamDUID := findFolderUIDBySourcePath(t, helper, repo, "teamC/teamD")
	require.NotEmpty(t, teamCUID)
	require.NotEmpty(t, teamDUID)

	requireFolderState(t, helper, teamCUID, "teamC", "teamC", repo)
	requireFolderState(t, helper, teamDUID, "teamD", "teamC/teamD", teamCUID)

	requireDashboardParents(t, helper, repo, map[string]string{
		"teamA/dashboard.json": "team-a-uid",
		"teamB/dashboard.json": "team-b-uid",
		"teamC/dashboard.json": teamCUID,
	})

	moveInProvisioningPath(t, helper, "teamB", "teamC/teamB")
	moveInProvisioningPath(t, helper, "teamC", "teamA/teamC")
	moveInProvisioningPath(t, helper, "teamA/teamC/teamD", "teamA/teamD")

	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "team-a-uid", "Team A Display", "teamA", repo)

	newTeamCUID := findFolderUIDBySourcePath(t, helper, repo, "teamA/teamC")
	require.NotEmpty(t, newTeamCUID)
	requireFolderState(t, helper, "team-b-uid", "Team B Display", "teamA/teamC/teamB", newTeamCUID)
	requireFolderState(t, helper, newTeamCUID, "teamC", "teamA/teamC", "team-a-uid")

	newTeamDUID := findFolderUIDBySourcePath(t, helper, repo, "teamA/teamD")
	require.NotEmpty(t, newTeamDUID)
	requireFolderState(t, helper, newTeamDUID, "teamD", "teamA/teamD", "team-a-uid")

	requireDashboardParents(t, helper, repo, map[string]string{
		"teamA/dashboard.json":             "team-a-uid",
		"teamA/teamC/teamB/dashboard.json": "team-b-uid",
		"teamA/teamC/dashboard.json":       newTeamCUID,
	})
}

func TestIntegrationProvisioning_FullSync_FolderMoveWithMetadata_NestedSubtree(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
	const repo = "folder-move-nested"

	writeToProvisioningPath(t, helper, "root/_folder.json", folderMetadataJSON("root-uid", "Root"))
	writeToProvisioningPath(t, helper, "root/child/_folder.json", folderMetadataJSON("child-uid", "Child"))
	writeToProvisioningPath(t, helper, "root/child/grand/.keep", []byte{})
	writeToProvisioningPath(t, helper, "other/.keep", []byte{})

	helper.CreateRepo(t, common.TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json":    "root/dashboard.json",
			"../testdata/text-options.json":  "root/child/dashboard.json",
			"../testdata/timeline-demo.json": "root/child/grand/dashboard.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "root-uid", "Root", "root", repo)
	requireFolderState(t, helper, "child-uid", "Child", "root/child", "root-uid")
	grandUID := findFolderUIDBySourcePath(t, helper, repo, "root/child/grand")
	require.NotEmpty(t, grandUID)
	requireFolderState(t, helper, grandUID, "grand", "root/child/grand", "child-uid")

	moveInProvisioningPath(t, helper, "root/child", "other/child")
	helper.SyncAndWait(t, repo, nil)

	otherUID := findFolderUIDBySourcePath(t, helper, repo, "other")
	require.NotEmpty(t, otherUID)
	requireFolderState(t, helper, "root-uid", "Root", "root", repo)
	requireFolderState(t, helper, "child-uid", "Child", "other/child", otherUID)
	newGrandUID := findFolderUIDBySourcePath(t, helper, repo, "other/child/grand")
	require.NotEmpty(t, newGrandUID)
	requireFolderState(t, helper, newGrandUID, "grand", "other/child/grand", "child-uid")

	requireDashboardParents(t, helper, repo, map[string]string{
		"root/dashboard.json":              "root-uid",
		"other/child/dashboard.json":       "child-uid",
		"other/child/grand/dashboard.json": newGrandUID,
	})
}

func TestIntegrationProvisioning_FullSync_FolderMoveWithMetadata_MixedLegacy(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
	const repo = "folder-move-mixed-legacy"

	writeToProvisioningPath(t, helper, "metaA/_folder.json", folderMetadataJSON("meta-a-uid", "Meta A"))
	writeToProvisioningPath(t, helper, "plainB/.keep", []byte{})

	helper.CreateRepo(t, common.TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json":   "metaA/dashboard.json",
			"../testdata/text-options.json": "plainB/dashboard.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "meta-a-uid", "Meta A", "metaA", repo)
	plainBUID := findFolderUIDBySourcePath(t, helper, repo, "plainB")
	require.NotEmpty(t, plainBUID)

	moveInProvisioningPath(t, helper, "plainB", "metaA/plainB")
	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "meta-a-uid", "Meta A", "metaA", repo)
	newPlainBUID := findFolderUIDBySourcePath(t, helper, repo, "metaA/plainB")
	require.NotEmpty(t, newPlainBUID)
	require.NotEqual(t, plainBUID, newPlainBUID, "plainB should get new UID without metadata")

	assertNoFolderAtPath(t, helper, repo, "plainB")
	requireDashboardParents(t, helper, repo, map[string]string{
		"metaA/dashboard.json":        "meta-a-uid",
		"metaA/plainB/dashboard.json": newPlainBUID,
	})
}

func TestIntegrationProvisioning_FullSync_FolderMoveWithMetadata_MetaToPlainParent(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
	const repo = "folder-move-meta-to-plain"

	writeToProvisioningPath(t, helper, "parent/_folder.json", folderMetadataJSON("parent-uid", "Parent"))
	writeToProvisioningPath(t, helper, "parent/child/_folder.json", folderMetadataJSON("child-uid", "Child"))

	helper.CreateRepo(t, common.TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json": "parent/child/dashboard.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "parent-uid", "Parent", "parent", repo)
	requireFolderState(t, helper, "child-uid", "Child", "parent/child", "parent-uid")

	moveInProvisioningPath(t, helper, "parent/child", "child")
	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "child-uid", "Child", "child", repo)
	requireFolderState(t, helper, "parent-uid", "Parent", "parent", repo)
	assertNoFolderAtPath(t, helper, repo, "parent/child")
	requireDashboardParents(t, helper, repo, map[string]string{
		"child/dashboard.json": "child-uid",
	})
}

func TestIntegrationProvisioning_FullSync_FolderMoveWithMetadata_RootToNested(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
	const repo = "folder-move-root-to-nested"

	// Root-level folder with metadata + a target nested parent.
	writeToProvisioningPath(t, helper, "myfolder/_folder.json", folderMetadataJSON("my-uid", "My Folder"))
	writeToProvisioningPath(t, helper, "parent/_folder.json", folderMetadataJSON("parent-uid", "Parent"))

	helper.CreateRepo(t, common.TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json": "myfolder/dashboard.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "my-uid", "My Folder", "myfolder", repo)
	requireFolderState(t, helper, "parent-uid", "Parent", "parent", repo)
	requireDashboardParents(t, helper, repo, map[string]string{
		"myfolder/dashboard.json": "my-uid",
	})

	// Move root-level folder into nested parent.
	moveInProvisioningPath(t, helper, "myfolder", "parent/myfolder")
	helper.SyncAndWait(t, repo, nil)

	// Folder should preserve UID but now be nested under parent.
	requireFolderState(t, helper, "my-uid", "My Folder", "parent/myfolder", "parent-uid")
	requireFolderState(t, helper, "parent-uid", "Parent", "parent", repo)
	assertNoFolderAtPath(t, helper, repo, "myfolder")
	requireDashboardParents(t, helper, repo, map[string]string{
		"parent/myfolder/dashboard.json": "my-uid",
	})
}

func TestIntegrationProvisioning_FullSync_FolderMoveWithMetadata_NestedToRoot(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
	const repo = "folder-move-nested-to-root"

	// Nested folder with metadata.
	writeToProvisioningPath(t, helper, "parent/_folder.json", folderMetadataJSON("parent-uid", "Parent"))
	writeToProvisioningPath(t, helper, "parent/child/_folder.json", folderMetadataJSON("child-uid", "Child"))

	helper.CreateRepo(t, common.TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json": "parent/child/dashboard.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "parent-uid", "Parent", "parent", repo)
	requireFolderState(t, helper, "child-uid", "Child", "parent/child", "parent-uid")
	requireDashboardParents(t, helper, repo, map[string]string{
		"parent/child/dashboard.json": "child-uid",
	})

	// Move nested folder to root level.
	moveInProvisioningPath(t, helper, "parent/child", "child")
	helper.SyncAndWait(t, repo, nil)

	// Child should preserve UID but now be at root (parent = repo).
	requireFolderState(t, helper, "child-uid", "Child", "child", repo)
	requireFolderState(t, helper, "parent-uid", "Parent", "parent", repo)
	assertNoFolderAtPath(t, helper, repo, "parent/child")
	requireDashboardParents(t, helper, repo, map[string]string{
		"child/dashboard.json": "child-uid",
	})
}

func TestIntegrationProvisioning_FullSync_FolderMovePreservesGeneration(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
	const repo = "folder-move-preserves-gen"

	writeToProvisioningPath(t, helper, "myfolder/_folder.json", folderMetadataJSON("my-uid", "My Folder"))
	writeToProvisioningPath(t, helper, "parent/_folder.json", folderMetadataJSON("parent-uid", "Parent"))
	writeToProvisioningPath(t, helper, "plain/.keep", []byte{})

	helper.CreateRepo(t, common.TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json":   "myfolder/dashboard.json",
			"../testdata/text-options.json": "plain/dashboard.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "my-uid", "My Folder", "myfolder", repo)
	requireFolderState(t, helper, "parent-uid", "Parent", "parent", repo)

	plainUID := findFolderUIDBySourcePath(t, helper, repo, "plain")
	require.NotEmpty(t, plainUID)

	initialGen := common.GetFolderGeneration(t, helper, "my-uid")
	require.Equal(t, int64(1), initialGen, "initial generation should be 1")

	myFolderObj, err := helper.Folders.Resource.Get(t.Context(), "my-uid", metav1.GetOptions{})
	require.NoError(t, err)
	initialCreationTimestamp := myFolderObj.GetCreationTimestamp()

	parentGenBefore := common.GetFolderGeneration(t, helper, "parent-uid")

	myFolderDashUID := common.FindDashboardUIDBySourcePath(t, helper, repo, "myfolder/dashboard.json")
	require.NotEmpty(t, myFolderDashUID)

	// Move metadata-backed folder under a different parent.
	moveInProvisioningPath(t, helper, "myfolder", "parent/myfolder")
	// Move non-metadata folder as well.
	moveInProvisioningPath(t, helper, "plain", "parent/plain")

	helper.SyncAndWait(t, repo, nil)

	// Metadata-backed folder: UID preserved, generation proves in-place update.
	requireFolderState(t, helper, "my-uid", "My Folder", "parent/myfolder", "parent-uid")
	newGen := common.GetFolderGeneration(t, helper, "my-uid")
	require.Equal(t, initialGen+1, newGen, "generation should increment by exactly 1 (in-place update, not delete+create)")

	// Creation timestamp must be unchanged — a delete+recreate would reset it.
	myFolderObjAfter, err := helper.Folders.Resource.Get(t.Context(), "my-uid", metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, initialCreationTimestamp, myFolderObjAfter.GetCreationTimestamp(),
		"creation timestamp must not change: folder was deleted and recreated")

	// Parent folder must not have been touched by the child move.
	parentGenAfter := common.GetFolderGeneration(t, helper, "parent-uid")
	require.Equal(t, parentGenBefore, parentGenAfter, "parent folder generation should not change when a child is moved under it")

	// Non-metadata folder: gets a new hash-based UID since the path changed.
	newPlainUID := findFolderUIDBySourcePath(t, helper, repo, "parent/plain")
	require.NotEmpty(t, newPlainUID)
	require.NotEqual(t, plainUID, newPlainUID, "non-metadata folder should get a new UID when its path changes")

	// Old plain folder object must be deleted, not just re-annotated.
	assertNoFolderByUID(t, helper, plainUID)

	// Old paths should be gone.
	assertNoFolderAtPath(t, helper, repo, "myfolder")
	assertNoFolderAtPath(t, helper, repo, "plain")

	requireDashboardParents(t, helper, repo, map[string]string{
		"parent/myfolder/dashboard.json": "my-uid",
		"parent/plain/dashboard.json":    newPlainUID,
	})

	// FIXME: Full sync recreates dashboards inside moved folders (delete+create)
	// instead of updating them in place. The dashboard UID is preserved because the
	// name comes from the file, but generation and creationTimestamp reset.
	newMyFolderDashUID := common.FindDashboardUIDBySourcePath(t, helper, repo, "parent/myfolder/dashboard.json")
	require.Equal(t, myFolderDashUID, newMyFolderDashUID,
		"dashboard UID should be preserved when its parent folder is moved")
}

// TestIntegrationProvisioning_FullSync_FolderMove_NestedToNested_PreservesGeneration verifies that
// moving a metadata-backed folder from one nested location to another nested location preserves its
// UID and increments the generation by exactly 1 (in-place update, not delete+recreate).
func TestIntegrationProvisioning_FullSync_FolderMove_NestedToNested_PreservesGeneration(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
	const repo = "folder-move-nested-to-nested-gen"

	writeToProvisioningPath(t, helper, "parentA/_folder.json", folderMetadataJSON("parent-a-uid", "Parent A"))
	writeToProvisioningPath(t, helper, "parentA/myfolder/_folder.json", folderMetadataJSON("my-uid", "My Folder"))
	writeToProvisioningPath(t, helper, "parentB/_folder.json", folderMetadataJSON("parent-b-uid", "Parent B"))

	helper.CreateRepo(t, common.TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json": "parentA/myfolder/dashboard.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "parent-a-uid", "Parent A", "parentA", repo)
	requireFolderState(t, helper, "parent-b-uid", "Parent B", "parentB", repo)
	requireFolderState(t, helper, "my-uid", "My Folder", "parentA/myfolder", "parent-a-uid")

	initialGen := common.GetFolderGeneration(t, helper, "my-uid")
	require.Equal(t, int64(1), initialGen, "initial generation should be 1")

	myFolderObj, err := helper.Folders.Resource.Get(t.Context(), "my-uid", metav1.GetOptions{})
	require.NoError(t, err)
	initialCreationTimestamp := myFolderObj.GetCreationTimestamp()

	dashUID := common.FindDashboardUIDBySourcePath(t, helper, repo, "parentA/myfolder/dashboard.json")
	require.NotEmpty(t, dashUID)

	// Move folder from parentA/myfolder to parentB/myfolder (nested → nested, different parent).
	moveInProvisioningPath(t, helper, "parentA/myfolder", "parentB/myfolder")
	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "my-uid", "My Folder", "parentB/myfolder", "parent-b-uid")
	assertNoFolderAtPath(t, helper, repo, "parentA/myfolder")

	newGen := common.GetFolderGeneration(t, helper, "my-uid")
	require.Equal(t, initialGen+1, newGen, "generation should increment by exactly 1 (in-place update, not delete+create)")

	myFolderObjAfter, err := helper.Folders.Resource.Get(t.Context(), "my-uid", metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, initialCreationTimestamp, myFolderObjAfter.GetCreationTimestamp(),
		"creation timestamp must not change: folder was deleted and recreated")

	requireDashboardParents(t, helper, repo, map[string]string{
		"parentB/myfolder/dashboard.json": "my-uid",
	})

	newDashUID := common.FindDashboardUIDBySourcePath(t, helper, repo, "parentB/myfolder/dashboard.json")
	require.Equal(t, dashUID, newDashUID, "dashboard UID should be preserved when its parent folder is moved")
}

// TestIntegrationProvisioning_FullSync_FolderMove_RootToNested_PreservesGeneration verifies that
// moving a metadata-backed folder from the root to a nested location preserves its UID and
// increments the generation by exactly 1 (in-place update, not delete+recreate).
func TestIntegrationProvisioning_FullSync_FolderMove_RootToNested_PreservesGeneration(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
	const repo = "folder-move-root-to-nested-gen"

	writeToProvisioningPath(t, helper, "myfolder/_folder.json", folderMetadataJSON("my-uid", "My Folder"))
	writeToProvisioningPath(t, helper, "parent/_folder.json", folderMetadataJSON("parent-uid", "Parent"))

	helper.CreateRepo(t, common.TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json": "myfolder/dashboard.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "my-uid", "My Folder", "myfolder", repo)
	requireFolderState(t, helper, "parent-uid", "Parent", "parent", repo)

	initialGen := common.GetFolderGeneration(t, helper, "my-uid")
	require.Equal(t, int64(1), initialGen, "initial generation should be 1")

	myFolderObj, err := helper.Folders.Resource.Get(t.Context(), "my-uid", metav1.GetOptions{})
	require.NoError(t, err)
	initialCreationTimestamp := myFolderObj.GetCreationTimestamp()

	dashUID := common.FindDashboardUIDBySourcePath(t, helper, repo, "myfolder/dashboard.json")
	require.NotEmpty(t, dashUID)

	// Move root-level folder under a nested parent (root → nested).
	moveInProvisioningPath(t, helper, "myfolder", "parent/myfolder")
	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "my-uid", "My Folder", "parent/myfolder", "parent-uid")
	assertNoFolderAtPath(t, helper, repo, "myfolder")

	newGen := common.GetFolderGeneration(t, helper, "my-uid")
	require.Equal(t, initialGen+1, newGen, "generation should increment by exactly 1 (in-place update, not delete+create)")

	myFolderObjAfter, err := helper.Folders.Resource.Get(t.Context(), "my-uid", metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, initialCreationTimestamp, myFolderObjAfter.GetCreationTimestamp(),
		"creation timestamp must not change: folder was deleted and recreated")

	requireDashboardParents(t, helper, repo, map[string]string{
		"parent/myfolder/dashboard.json": "my-uid",
	})

	newDashUID := common.FindDashboardUIDBySourcePath(t, helper, repo, "parent/myfolder/dashboard.json")
	require.Equal(t, dashUID, newDashUID, "dashboard UID should be preserved when its parent folder is moved")
}

// TestIntegrationProvisioning_FullSync_FolderMove_NestedToRoot_PreservesGeneration verifies that
// moving a metadata-backed folder from a nested location to the root preserves its UID and
// increments the generation by exactly 1 (in-place update, not delete+recreate).
func TestIntegrationProvisioning_FullSync_FolderMove_NestedToRoot_PreservesGeneration(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
	const repo = "folder-move-nested-to-root-gen"

	writeToProvisioningPath(t, helper, "parent/_folder.json", folderMetadataJSON("parent-uid", "Parent"))
	writeToProvisioningPath(t, helper, "parent/myfolder/_folder.json", folderMetadataJSON("my-uid", "My Folder"))

	helper.CreateRepo(t, common.TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json": "parent/myfolder/dashboard.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "parent-uid", "Parent", "parent", repo)
	requireFolderState(t, helper, "my-uid", "My Folder", "parent/myfolder", "parent-uid")

	initialGen := common.GetFolderGeneration(t, helper, "my-uid")
	require.Equal(t, int64(1), initialGen, "initial generation should be 1")

	myFolderObj, err := helper.Folders.Resource.Get(t.Context(), "my-uid", metav1.GetOptions{})
	require.NoError(t, err)
	initialCreationTimestamp := myFolderObj.GetCreationTimestamp()

	dashUID := common.FindDashboardUIDBySourcePath(t, helper, repo, "parent/myfolder/dashboard.json")
	require.NotEmpty(t, dashUID)

	// Move nested folder to root level (nested → root).
	moveInProvisioningPath(t, helper, "parent/myfolder", "myfolder")
	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "my-uid", "My Folder", "myfolder", repo)
	requireFolderState(t, helper, "parent-uid", "Parent", "parent", repo)
	assertNoFolderAtPath(t, helper, repo, "parent/myfolder")

	newGen := common.GetFolderGeneration(t, helper, "my-uid")
	require.Equal(t, initialGen+1, newGen, "generation should increment by exactly 1 (in-place update, not delete+create)")

	myFolderObjAfter, err := helper.Folders.Resource.Get(t.Context(), "my-uid", metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, initialCreationTimestamp, myFolderObjAfter.GetCreationTimestamp(),
		"creation timestamp must not change: folder was deleted and recreated")

	requireDashboardParents(t, helper, repo, map[string]string{
		"myfolder/dashboard.json": "my-uid",
	})

	newDashUID := common.FindDashboardUIDBySourcePath(t, helper, repo, "myfolder/dashboard.json")
	require.Equal(t, dashUID, newDashUID, "dashboard UID should be preserved when its parent folder is moved")
}

// TestIntegrationProvisioning_FullSync_FolderMoveUpdatesChildrenFolders verifies that when an
// intermediate metadata-backed folder is moved to a different parent, all of its children have
// their sourcePath and parent annotations updated correctly.
func TestIntegrationProvisioning_FullSync_FolderMoveUpdatesChildrenFolders(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
	const repo = "folder-move-children-update"

	// Three-level hierarchy: folderA → folderB → folderC, all metadata-backed.
	// target/ is the destination parent for the move.
	writeToProvisioningPath(t, helper, "folderA/_folder.json", folderMetadataJSON("a-uid", "Folder A"))
	writeToProvisioningPath(t, helper, "folderA/.keep", []byte{})
	writeToProvisioningPath(t, helper, "folderA/folderB/_folder.json", folderMetadataJSON("b-uid", "Folder B"))
	writeToProvisioningPath(t, helper, "folderA/folderB/.keep", []byte{})
	writeToProvisioningPath(t, helper, "folderA/folderB/folderC/_folder.json", folderMetadataJSON("c-uid", "Folder C"))
	writeToProvisioningPath(t, helper, "folderA/folderB/folderC/.keep", []byte{})
	writeToProvisioningPath(t, helper, "target/_folder.json", folderMetadataJSON("target-uid", "Target"))
	writeToProvisioningPath(t, helper, "target/.keep", []byte{})

	helper.CreateRepo(t, common.TestRepo{
		Name:                   repo,
		Target:                 "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "a-uid", "Folder A", "folderA", repo)
	requireFolderState(t, helper, "b-uid", "Folder B", "folderA/folderB", "a-uid")
	requireFolderState(t, helper, "c-uid", "Folder C", "folderA/folderB/folderC", "b-uid")
	requireFolderState(t, helper, "target-uid", "Target", "target", repo)

	// Move the intermediate folder B (with its subtree) out of A and into target.
	moveInProvisioningPath(t, helper, "folderA/folderB", "target/folderB")
	helper.SyncAndWait(t, repo, nil)

	// Folder A stays in place, unaffected.
	requireFolderState(t, helper, "a-uid", "Folder A", "folderA", repo)

	// Folder B moved: sourcePath and parent annotation must reflect the new location.
	requireFolderState(t, helper, "b-uid", "Folder B", "target/folderB", "target-uid")

	// Folder C (child of B): sourcePath must be updated, but parent annotation stays as b-uid
	// because B kept its UID — no pointer is broken.
	requireFolderState(t, helper, "c-uid", "Folder C", "target/folderB/folderC", "b-uid")

	// Old paths must be gone.
	assertNoFolderAtPath(t, helper, repo, "folderA/folderB")
	assertNoFolderAtPath(t, helper, repo, "folderA/folderB/folderC")
}

// TestIntegrationProvisioning_FullSync_FolderMoveWithUIDChange_NoGenerationPreservation is a
// negative test for augmentChangesForFolderMoves. When a folder is moved AND its _folder.json UID
// is changed simultaneously, the DELETE (old UID at old path) and the CREATE (new UID at new path)
// have different UIDs, so augmentChangesForFolderMoves cannot merge them into a single UPDATE.
func TestIntegrationProvisioning_FullSync_FolderMoveWithUIDChange_NoGenerationPreservation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
	const repo = "folder-move-uid-change"

	writeToProvisioningPath(t, helper, "myfolder/_folder.json", folderMetadataJSON("original-uid", "My Folder"))
	writeToProvisioningPath(t, helper, "myfolder/.keep", []byte{})

	helper.CreateRepo(t, common.TestRepo{
		Name:                   repo,
		Target:                 "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "original-uid", "My Folder", "myfolder", repo)
	require.Equal(t, int64(1), common.GetFolderGeneration(t, helper, "original-uid"), "initial generation should be 1")

	// Move the folder directory to a new path AND replace the _folder.json with a different UID.
	// augmentChangesForFolderMoves requires the UID to be the same for a move-merge; since the UID
	// differs, it emits a plain DELETE + CREATE instead of a single in-place UPDATE.
	moveInProvisioningPath(t, helper, "myfolder", "newlocation")
	writeToProvisioningPath(t, helper, "newlocation/_folder.json", folderMetadataJSON("new-uid", "My Folder"))

	helper.SyncAndWait(t, repo, nil)

	// The original folder must be fully removed (not just re-annotated).
	assertNoFolderByUID(t, helper, "original-uid")

	// The new folder at the moved path must exist with the new UID, freshly created.
	requireFolderState(t, helper, "new-uid", "My Folder", "newlocation", repo)
	require.Equal(t, int64(1), common.GetFolderGeneration(t, helper, "new-uid"),
		"generation must be 1: folder was deleted and recreated, not updated in-place")
}

func folderMetadataJSON(uid, title string) []byte {
	folder := map[string]any{
		"apiVersion": "folder.grafana.app/v1beta1",
		"kind":       "Folder",
		"metadata": map[string]any{
			"name": uid,
		},
		"spec": map[string]any{
			"title": title,
		},
	}
	data, _ := json.MarshalIndent(folder, "", "\t")
	return data
}

func writeToProvisioningPath(t *testing.T, helper *common.ProvisioningTestHelper, relativePath string, data []byte) {
	t.Helper()
	fullPath := filepath.Join(helper.ProvisioningPath, relativePath)
	require.NoError(t, os.MkdirAll(filepath.Dir(fullPath), 0o750))
	require.NoError(t, os.WriteFile(fullPath, data, 0o600))
}

func moveInProvisioningPath(t *testing.T, helper *common.ProvisioningTestHelper, from, to string) {
	t.Helper()
	fromPath := filepath.Join(helper.ProvisioningPath, from)
	toPath := filepath.Join(helper.ProvisioningPath, to)
	require.NoError(t, os.MkdirAll(filepath.Dir(toPath), 0o750), "create parent for move destination")
	require.NoError(t, os.Rename(fromPath, toPath), "move %s to %s", from, to)
}

func requireFolderState(t *testing.T, helper *common.ProvisioningTestHelper, folderUID, expectedTitle, expectedSourcePath, expectedParent string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		obj, err := helper.Folders.Resource.Get(t.Context(), folderUID, metav1.GetOptions{})
		if !assert.NoError(c, err, "failed to get folder %s", folderUID) {
			return
		}

		title, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
		assert.Equal(c, expectedTitle, title, "folder title")

		annotations := obj.GetAnnotations()
		assert.Equal(c, expectedSourcePath, annotations["grafana.app/sourcePath"], "source path")
		assert.Equal(c, expectedParent, annotations["grafana.app/folder"], "parent folder")
	}, 30*time.Second, 100*time.Millisecond,
		"expected folder %q with title=%q sourcePath=%q parent=%q", folderUID, expectedTitle, expectedSourcePath, expectedParent)
}

func findFolderUIDBySourcePath(t *testing.T, helper *common.ProvisioningTestHelper, repoName, sourcePath string) string {
	t.Helper()
	var uid string
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list folders") {
			return
		}
		for _, f := range list.Items {
			annotations := f.GetAnnotations()
			if annotations["grafana.app/managerId"] != repoName {
				continue
			}
			if annotations["grafana.app/sourcePath"] == sourcePath {
				uid = f.GetName()
				return
			}
		}
		c.Errorf("no folder managed by %q with sourcePath %q found", repoName, sourcePath)
	}, 30*time.Second, 100*time.Millisecond,
		"expected folder with sourcePath %q for repo %q", sourcePath, repoName)
	return uid
}

func requireDashboardParents(t *testing.T, helper *common.ProvisioningTestHelper, repoName string, expected map[string]string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list dashboards") {
			return
		}
		found := make(map[string]string)
		for _, d := range list.Items {
			annotations := d.GetAnnotations()
			if annotations["grafana.app/managerId"] != repoName {
				continue
			}
			sourcePath := annotations["grafana.app/sourcePath"]
			if _, ok := expected[sourcePath]; ok {
				found[sourcePath] = annotations["grafana.app/folder"]
			}
		}
		for sourcePath, expectedParent := range expected {
			actualParent, ok := found[sourcePath]
			if !assert.True(c, ok, "dashboard with sourcePath %q not found", sourcePath) {
				continue
			}
			assert.Equal(c, expectedParent, actualParent, "dashboard %q parent folder", sourcePath)
		}
	}, 30*time.Second, 100*time.Millisecond,
		"expected dashboards with correct parents for repo %q", repoName)
}

func assertNoFolderAtPath(t *testing.T, helper *common.ProvisioningTestHelper, repoName, sourcePath string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list folders") {
			return
		}
		for _, f := range list.Items {
			annotations := f.GetAnnotations()
			if annotations["grafana.app/managerId"] != repoName {
				continue
			}
			if annotations["grafana.app/sourcePath"] == sourcePath {
				c.Errorf("folder managed by %q still present at %q", repoName, sourcePath)
				return
			}
		}
	}, 30*time.Second, 100*time.Millisecond,
		"folder at path %q should be absent for repo %q", sourcePath, repoName)
}

func assertNoFolderByUID(t *testing.T, helper *common.ProvisioningTestHelper, folderUID string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.Folders.Resource.Get(t.Context(), folderUID, metav1.GetOptions{})
		if err == nil {
			c.Errorf("folder %q still exists, expected NotFound", folderUID)
			return
		}
		assert.True(c, apierrors.IsNotFound(err),
			"expected NotFound error for folder %q, got: %v", folderUID, err)
	}, 30*time.Second, 100*time.Millisecond,
		"folder %q should be deleted", folderUID)
}

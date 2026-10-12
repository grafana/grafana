package foldermetadata

import (
	"strings"
	"testing"

	"github.com/grafana/nanogit/gittest"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_HiddenPaths(t *testing.T) {
	for _, target := range []string{"folderless", "folder", "instance"} {
		t.Run(target, func(t *testing.T) {
			helper := sharedGitHelper(t)
			repoName := "hidden-paths-" + target
			createRepo := helper.CreateFolderlessTargetGitRepo
			expectedFolders := []string{"team"}
			switch target {
			case "folder":
				createRepo = helper.CreateFolderTargetGitRepo
				expectedFolders = append(expectedFolders, "")
			case "instance":
				createRepo = helper.CreateGitRepo
			}
			_, local := createRepo(t, repoName, map[string][]byte{
				"dashboard.json":             common.DashboardJSON("visible-root", "Root", 1),
				"team/dashboard.json":        common.DashboardJSON("visible-team", "Team", 1),
				"team/_folder.json":          folderMetadataJSON("team-uid", "Team"),
				".config.json":               []byte("not JSON"),
				".ci/_folder.json":           []byte("not folder metadata"),
				".ci/.keep":                  {},
				".ci/nested/pipeline.yaml":   []byte("not: [valid YAML"),
				".github/.keep":              {},
				".github/workflows/lint.yml": []byte("on: push"),
				"team/.ci/pipeline.json":     []byte("not JSON"),
			})

			common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded(), common.Expect(requireNoHiddenPathWarnings))
			helper.RequireRepoDashboardCount(t, repoName, 2)
			common.RequireRepoFolders(t, helper.Folders, repoName, expectedFolders)

			require.NoError(t, local.CreateFile(".ci/_folder.json", "still not folder metadata"))
			require.NoError(t, local.CreateFile(".ci/new/_folder.json", "invalid metadata"))
			_, err := local.Git("rm", ".github/workflows/lint.yml")
			require.NoError(t, err)
			commitHiddenPathChanges(t, local)
			common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded(), common.Expect(requireNoHiddenPathWarnings))
			common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded(), common.Expect(requireNoHiddenPathWarnings))
			helper.RequireRepoDashboardCount(t, repoName, 2)
			common.RequireRepoFolders(t, helper.Folders, repoName, expectedFolders)

			require.NoError(t, local.CreateFile("empty/.keep", ""))
			commitHiddenPathChanges(t, local)
			before, err := local.Git("rev-parse", "HEAD")
			require.NoError(t, err)
			job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
				Action: provisioning.JobActionFixFolderMetadata,
			})
			common.HasState(provisioning.JobStateSuccess)(t, job)
			common.HasNoErrors()(t, job)
			requireNoHiddenPathWarnings(t, job)
			_, err = local.Git("fetch", "origin", "main")
			require.NoError(t, err)
			changed, err := local.Git("diff", "--name-only", strings.TrimSpace(before), "origin/main")
			require.NoError(t, err)
			require.ElementsMatch(t, []string{"empty/.keep", "empty/_folder.json"}, strings.Fields(changed))
		})
	}
}

func TestIntegrationProvisioning_HiddenPaths_FolderRename(t *testing.T) {
	helper := sharedGitHelper(t)
	const repoName = "hidden-folder-rename"
	_, local := helper.CreateFolderlessTargetGitRepo(t, repoName, map[string][]byte{
		"dashboard.json":      common.DashboardJSON("visible-root", "Root", 1),
		"team/dashboard.json": common.DashboardJSON("visible-team", "Team", 1),
		"team/_folder.json":   folderMetadataJSON("team-uid", "Team"),
	})
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

	for _, move := range []struct {
		from, to   string
		dashboards int
		folders    []string
	}{
		{from: "team", to: ".ci", dashboards: 1},
		{from: ".ci", to: "team", dashboards: 2, folders: []string{"team"}},
	} {
		t.Run(move.from+" to "+move.to, func(t *testing.T) {
			_, err := local.Git("mv", move.from, move.to)
			require.NoError(t, err)
			commitHiddenPathChanges(t, local)
			common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded(), common.Expect(requireNoHiddenPathWarnings))
			helper.RequireRepoDashboardCount(t, repoName, move.dashboards)
			common.RequireRepoFolders(t, helper.Folders, repoName, move.folders)
			common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded(), common.Expect(requireNoHiddenPathWarnings))
			helper.RequireRepoDashboardCount(t, repoName, move.dashboards)
			common.RequireRepoFolders(t, helper.Folders, repoName, move.folders)
		})
	}
	common.RequireRepoDashboardParent(t, helper.DashboardsV1, repoName, "team/dashboard.json", "team-uid")
}

func TestIntegrationProvisioning_HiddenPaths_MetadataRename(t *testing.T) {
	helper := sharedGitHelper(t)
	const repoName = "hidden-metadata-rename"
	_, local := helper.CreateFolderlessTargetGitRepo(t, repoName, map[string][]byte{
		"team/dashboard.json": common.DashboardJSON("visible-team", "Team", 1),
		"team/_folder.json":   folderMetadataJSON("team-uid", "Team"),
		".ci/.keep":           {},
	})
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

	_, err := local.Git("mv", "team/_folder.json", ".ci/_folder.json")
	require.NoError(t, err)
	commitHiddenPathChanges(t, local)
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Warning())
	fallbackUID := common.RequireRepoFolderTitle(t, helper.Folders, repoName, "team")
	require.NotEqual(t, "team-uid", fallbackUID)
	common.RequireRepoDashboardParent(t, helper.DashboardsV1, repoName, "team/dashboard.json", fallbackUID)
	common.RequireRepoFolders(t, helper.Folders, repoName, []string{"team"})
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Warning())
	common.RequireRepoFolderUID(t, helper.Folders, repoName, fallbackUID)

	_, err = local.Git("mv", ".ci/_folder.json", "team/_folder.json")
	require.NoError(t, err)
	commitHiddenPathChanges(t, local)
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded(), common.Expect(requireNoHiddenPathWarnings))
	common.RequireRepoDashboardParent(t, helper.DashboardsV1, repoName, "team/dashboard.json", "team-uid")
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded(), common.Expect(requireNoHiddenPathWarnings))
	common.RequireRepoFolders(t, helper.Folders, repoName, []string{"team"})
	helper.RequireRepoDashboardCount(t, repoName, 1)
}

func TestIntegrationProvisioning_HiddenPaths_KeepTypeChange(t *testing.T) {
	helper := sharedGitHelper(t)
	const repoName = "keep-type-change"
	_, local := helper.CreateFolderlessTargetGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("visible-root", "Root", 1),
		"empty/.keep":    {},
	})
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Warning())
	folderUID := common.RequireRepoFolderTitle(t, helper.Folders, repoName, "empty")

	for _, tc := range []struct {
		name, path string
		outcome    common.SyncOption
	}{
		{"file to directory", "empty/.keep/dashboard.json", common.Succeeded()},
		{"directory to file", "empty/.keep", common.Warning()},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := local.Git("rm", "-r", "empty/.keep")
			require.NoError(t, err)
			require.NoError(t, local.CreateFile(tc.path, string(common.DashboardJSON("hidden-dashboard", "Hidden", 1))))
			commitHiddenPathChanges(t, local)

			common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, tc.outcome)
			helper.RequireRepoDashboardCount(t, repoName, 1)
			common.RequireRepoFolders(t, helper.Folders, repoName, []string{"empty"})
			common.RequireRepoFolderUID(t, helper.Folders, repoName, folderUID)

			common.SyncAndWait(t, helper, common.Repo(repoName), common.Warning())
			helper.RequireRepoDashboardCount(t, repoName, 1)
			common.RequireRepoFolders(t, helper.Folders, repoName, []string{"empty"})
			common.RequireRepoFolderUID(t, helper.Folders, repoName, folderUID)
		})
	}
}

func requireNoHiddenPathWarnings(t *testing.T, job *unstructured.Unstructured) {
	t.Helper()
	warnings, _, err := unstructured.NestedStringSlice(job.Object, "status", "warnings")
	require.NoError(t, err)
	require.Empty(t, warnings)
}

func commitHiddenPathChanges(t *testing.T, local *gittest.LocalRepo) {
	t.Helper()
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "change hidden paths")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)
}

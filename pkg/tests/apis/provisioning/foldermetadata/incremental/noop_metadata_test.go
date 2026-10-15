package incremental

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_IncrementalSync_NoopFolderMetadata(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, tc := range []struct {
		name        string
		metadata    []byte
		folderTitle string
		state       provisioning.JobState
		reason      string
		warning     string
	}{
		{
			name:        "missing",
			folderTitle: "team",
			state:       provisioning.JobStateWarning,
			reason:      provisioning.ReasonMissingFolderMetadata,
			warning:     "missing folder metadata",
		},
		{
			name:        "invalid",
			metadata:    invalidFolderMetadataJSON("Broken Team"),
			folderTitle: "team",
			state:       provisioning.JobStateWarning,
			reason:      provisioning.ReasonCompletedWithWarnings,
			warning:     "invalid folder metadata",
		},
		{
			name:        "valid",
			metadata:    folderMetadataJSON("noop-team", "Team"),
			folderTitle: "Team",
			state:       provisioning.JobStateSuccess,
			reason:      provisioning.ReasonSuccess,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			helper := sharedGitHelper(t)
			repoName := "noop-meta-" + tc.name
			files := map[string][]byte{
				"team/dashboard.json": common.DashboardJSON("noop-dash", "Noop Dashboard", 1),
			}
			if tc.metadata != nil {
				files["team/_folder.json"] = tc.metadata
			}
			_, local := helper.CreateGitRepo(t, repoName, files)
			common.SyncAndWait(t, helper, common.Repo(repoName), common.Expect(common.HasNoErrors(), common.HasState(tc.state)))
			folderUID := common.RequireRepoFolderTitle(t, helper.Folders, repoName, tc.folderTitle)

			for _, noop := range []struct {
				name        string
				emptyCommit bool
				message     string
			}{
				{name: "same ref", message: "same commit as last time"},
				{name: "empty commit", emptyCommit: true, message: "no changes detected between commits"},
			} {
				t.Run(noop.name, func(t *testing.T) {
					if noop.emptyCommit {
						_, err := local.Git("commit", "--allow-empty", "-m", "advance ref without changing files")
						require.NoError(t, err)
						diff, err := local.Git("diff", "--name-only", "HEAD^", "HEAD")
						require.NoError(t, err)
						require.Empty(t, strings.TrimSpace(diff))
						_, err = local.Git("push")
						require.NoError(t, err)
					}

					common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental,
						common.Expect(common.HasNoErrors(), common.HasState(tc.state), func(t *testing.T, job *unstructured.Unstructured) {
							jobObj := common.MustFromUnstructured[provisioning.Job](t, job)
							require.Equal(t, noop.message, jobObj.Status.Message)
							if tc.warning == "" {
								require.Empty(t, jobObj.Status.Warnings)
							} else {
								common.RequireJobWarningContains(t, jobObj, tc.warning)
								common.RequireJobWarningContains(t, jobObj, "team/")
							}
						}))
					helper.WaitForConditionReason(t, repoName, provisioning.ConditionTypePullStatus, tc.reason)
					common.RequireRepoFolderUID(t, helper.Folders, repoName, folderUID)
					common.RequireDashboards(t, helper.DashboardsV1, map[string]common.ExpectedDashboard{
						"noop-dash": {Title: "Noop Dashboard", SourcePath: "team/dashboard.json", Folder: folderUID},
					})
				})
			}
		})
	}
}

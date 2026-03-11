package provisioning

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationProvisioning_FullSync_MissingFolderMetadata_FlagEnabled verifies that when the
// provisioningFolderMetadata feature flag is enabled, a full sync on a repository that has folders
// without _folder.json produces a warning job state and a MissingFolderMetadata condition reason.
func TestIntegrationProvisioning_FullSync_MissingFolderMetadata_FlagEnabled(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("single folder", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
		const repo = "missing-folder-meta-single"
		helper.CreateRepo(t, common.TestRepo{
			Name:   repo,
			Target: "folder",
			Copies: map[string]string{
				// Dashboard inside a folder that intentionally has no _folder.json
				"testdata/all-panels.json": "myfolder/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		jobObj := &provisioning.Job{}
		err := runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
		require.NoError(t, err)

		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
			"job should complete with warning state when a folder is missing _folder.json")
		require.NotEmpty(t, jobObj.Status.Warnings, "job should have at least one warning")
		require.Empty(t, jobObj.Status.Errors, "missing _folder.json should be a warning, not an error")

		found := false
		for _, w := range jobObj.Status.Warnings {
			if strings.Contains(w, "missing folder metadata") {
				found = true
				break
			}
		}
		require.True(t, found, "a warning should mention missing folder metadata; warnings: %v", jobObj.Status.Warnings)

		helper.WaitForConditionReason(t, repo, provisioning.ConditionTypePullStatus, provisioning.ReasonMissingFolderMetadata)
	})

	t.Run("multiple folders", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
		const repo = "missing-folder-meta-multi"
		helper.CreateRepo(t, common.TestRepo{
			Name:   repo,
			Target: "folder",
			Copies: map[string]string{
				// Two dashboards in separate folders, neither has a _folder.json
				"testdata/all-panels.json":    "folderA/dashboard1.json",
				"testdata/timeline-demo.json": "folderB/dashboard2.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		jobObj := &provisioning.Job{}
		err := runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
		require.NoError(t, err)

		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
			"job should complete with warning state when folders are missing _folder.json")
		require.Empty(t, jobObj.Status.Errors, "missing _folder.json should be warnings, not errors")

		// Count warnings that mention missing folder metadata
		var metadataWarnings []string
		for _, w := range jobObj.Status.Warnings {
			if strings.Contains(w, "missing folder metadata") {
				metadataWarnings = append(metadataWarnings, w)
			}
		}
		require.GreaterOrEqual(t, len(metadataWarnings), 2,
			"expected at least 2 missing-folder-metadata warnings (one per folder); got: %v", metadataWarnings)

		// Verify both folders are mentioned
		joined := strings.Join(metadataWarnings, "\n")
		require.Contains(t, joined, "folderA", "warning should mention folderA")
		require.Contains(t, joined, "folderB", "warning should mention folderB")

		helper.WaitForConditionReason(t, repo, provisioning.ConditionTypePullStatus, provisioning.ReasonMissingFolderMetadata)
	})
}

// TestIntegrationProvisioning_FullSync_MissingFolderMetadata_FlagDisabled verifies that when the
// provisioningFolderMetadata feature flag is disabled, a full sync on a repository with a folder
// that has no _folder.json completes successfully without any _folder.json-related warnings.
func TestIntegrationProvisioning_FullSync_MissingFolderMetadata_FlagDisabled(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const repo = "missing-folder-meta-disabled"
	// No withProvisioningFolderMetadata option → flag is disabled
	helper := common.RunGrafana(t)
	helper.CreateRepo(t, common.TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"testdata/all-panels.json": "myfolder/dashboard.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	jobObj := &provisioning.Job{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
	require.NoError(t, err)

	require.Equal(t, provisioning.JobStateSuccess, jobObj.Status.State,
		"job should succeed when flag is disabled (no _folder.json check)")

	for _, w := range jobObj.Status.Warnings {
		require.NotContains(t, w, "missing folder metadata",
			"no warning about missing folder metadata should appear when flag is disabled")
	}

	helper.WaitForConditionReason(t, repo, provisioning.ConditionTypePullStatus, provisioning.ReasonSuccess)
}

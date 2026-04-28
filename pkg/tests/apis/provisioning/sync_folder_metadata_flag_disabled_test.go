package provisioning

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_FullSync_MissingFolderMetadata_FlagDisabled verifies that when the
// provisioningFolderMetadata feature flag is disabled, a full sync on a repository with a folder
// that has no _folder.json completes successfully without any _folder.json-related warnings.
// The core provisioning shared server runs with the flag off.
func TestIntegrationProvisioning_FullSync_MissingFolderMetadata_FlagDisabled(t *testing.T) {
	const repo = "missing-folder-meta-disabled"
	helper := sharedHelper(t)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
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

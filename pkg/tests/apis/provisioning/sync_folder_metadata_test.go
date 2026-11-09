package provisioning

import (
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_FullSync_MissingFolderMetadata(t *testing.T) {
	const repo = "missing-folder-meta"
	helper := sharedHelper(t)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies: map[string]string{
			"testdata/all-panels.json": "myfolder/dashboard.json",
		},
		SkipSync: true,
	})

	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	common.HasOnlyMissingFolderMetadataWarnings("myfolder")(t, job)

	helper.RequireRepoDashboardCount(t, repo, 1)
	helper.WaitForConditionReason(t, repo, provisioning.ConditionTypePullStatus, provisioning.ReasonMissingFolderMetadata)
}

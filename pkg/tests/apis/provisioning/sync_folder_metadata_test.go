package provisioning

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

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

	jobObj := &provisioning.Job{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
	require.NoError(t, err)

	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"full sync should warn about missing folder metadata")
	require.Empty(t, jobObj.Status.Errors)
	require.Contains(t, strings.Join(jobObj.Status.Warnings, "\n"), "missing folder metadata")
	helper.RequireRepoDashboardCount(t, repo, 1)
	helper.WaitForConditionReason(t, repo, provisioning.ConditionTypePullStatus, provisioning.ReasonMissingFolderMetadata)
}

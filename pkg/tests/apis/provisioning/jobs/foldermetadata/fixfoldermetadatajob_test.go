package foldermetadata

import (
	"testing"

	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_FixFolderMetadataJob(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "fix-folder-metadata-test-repo"
	testRepo := common.TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"../../testdata/all-panels.json": "dashboard1.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    1,
	}
	helper.CreateRepo(t, testRepo)

	t.Run("job completes successfully", func(t *testing.T) {
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionFixFolderMetadata,
		}

		job := helper.TriggerJobAndWaitForComplete(t, repo, spec)
		state := common.MustNestedString(job.Object, "status", "state")
		if state != "success" {
			if msg, ok := job.Object["status"].(map[string]interface{})["message"].(string); ok {
				t.Logf("Job error message: %s", msg)
			}
			if errs, ok := job.Object["status"].(map[string]interface{})["errors"].([]interface{}); ok {
				t.Logf("Job errors: %v", errs)
			}
		}
		require.Equal(t, "success", state, "fix-folder-metadata job should complete with success")
	})

	t.Run("job with explicit empty ref completes successfully", func(t *testing.T) {
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionFixFolderMetadata,
			FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{
				Ref: "",
			},
		}

		job := helper.TriggerJobAndWaitForComplete(t, repo, spec)
		state := common.MustNestedString(job.Object, "status", "state")
		require.Equal(t, "success", state, "fix-folder-metadata job with explicit empty ref should complete with success")
	})

	t.Run("job with empty options uses default ref", func(t *testing.T) {
		spec := provisioning.JobSpec{
			Action:            provisioning.JobActionFixFolderMetadata,
			FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{},
		}

		job := helper.TriggerJobAndWaitForComplete(t, repo, spec)
		state := common.MustNestedString(job.Object, "status", "state")
		require.Equal(t, "success", state, "fix-folder-metadata job with empty options should complete with success")
	})
}

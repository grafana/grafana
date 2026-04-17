package foldermetadata

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_FixFolderMetadataJob(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "fix-folder-metadata-test-repo"
	testRepo := common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Workflows:  []string{"write"},
		Copies: map[string]string{
			"../testdata/all-panels.json": "dashboard1.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    1,
	}
	helper.CreateLocalRepo(t, testRepo)

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

// TestIntegrationProvisioning_FixFolderMetadataJob_RemovesKeepFiles verifies
// that running the fix-folder-metadata job removes legacy .keep files from
// folders once they have a _folder.json (whether pre-existing or newly created).
func TestIntegrationProvisioning_FixFolderMetadataJob_RemovesKeepFiles(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "fix-folder-metadata-keep-files"
	testRepo := common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		Workflows:              []string{"write"},
		SkipResourceAssertions: true,
	}
	helper.CreateLocalRepo(t, testRepo)

	// Plant .keep files in both folder directories, mimicking legacy state
	// where folders were tracked via .keep instead of _folder.json.
	helper.WriteToProvisioningPath(t, "parent/.keep", []byte{})
	helper.WriteToProvisioningPath(t, "parent/child/.keep", []byte{})

	// Plant a valid _folder.json in the parent folder only.
	// The child folder intentionally has no _folder.json so the job must create one.
	parentMeta := marshalFolderMetadata(t, "pre-existing-parent-uid", "parent")
	helper.WriteToProvisioningPath(t, "parent/_folder.json", parentMeta)

	spec := provisioning.JobSpec{
		Action: provisioning.JobActionFixFolderMetadata,
	}
	job := helper.TriggerJobAndWaitForComplete(t, repo, spec)
	state := common.MustNestedString(job.Object, "status", "state")
	require.Equal(t, "success", state, "fix-folder-metadata job should complete with success")

	t.Run("keep file removed from folder with existing _folder.json", func(t *testing.T) {
		_, err := os.Stat(filepath.Join(helper.ProvisioningPath, "parent", ".keep"))
		require.True(t, os.IsNotExist(err), ".keep must be removed from parent folder that already had _folder.json")
	})

	t.Run("keep file removed from folder where job creates _folder.json", func(t *testing.T) {
		_, err := os.Stat(filepath.Join(helper.ProvisioningPath, "parent", "child", ".keep"))
		require.True(t, os.IsNotExist(err), ".keep must be removed from child folder where job created _folder.json")
	})

	t.Run("existing _folder.json is not overwritten", func(t *testing.T) {
		data, err := os.ReadFile(filepath.Join(helper.ProvisioningPath, "parent", "_folder.json")) //nolint:gosec
		require.NoError(t, err)
		var obj map[string]interface{}
		require.NoError(t, json.Unmarshal(data, &obj))
		meta, _ := obj["metadata"].(map[string]interface{})
		require.Equal(t, "pre-existing-parent-uid", meta["name"],
			"pre-existing parent _folder.json must not be overwritten by the job")
	})

	t.Run("_folder.json is created for folder without metadata", func(t *testing.T) {
		_, err := os.Stat(filepath.Join(helper.ProvisioningPath, "parent", "child", "_folder.json"))
		require.NoError(t, err, "_folder.json must be created for child folder that had no metadata")
	})
}

// marshalFolderMetadata builds a valid _folder.json payload with the given UID and title.
func marshalFolderMetadata(t *testing.T, uid, title string) []byte {
	t.Helper()
	f := folders.NewFolder()
	f.SetGroupVersionKind(folders.FolderResourceInfo.GroupVersionKind())
	f.Name = uid
	f.Spec.Title = title
	data, err := json.Marshal(f)
	require.NoError(t, err)
	return data
}

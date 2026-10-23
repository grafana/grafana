package git

import (
	"strings"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestIntegrationProvisioning_IncrementalSync_MissingFolderMetadata(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "incr-missing-meta"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("root-dash", "Root Dashboard", 1),
	})

	// Full sync.
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

	// Add a dashboard inside a folder with no _folder.json.
	require.NoError(t, local.CreateFile("myfolder/dashboard2.json", string(common.DashboardJSON("folder-dash", "Folder Dashboard", 1))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "add dashboard in folder without metadata")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	// Trigger incremental sync.
	job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{Incremental: true},
	})
	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	require.Empty(t, jobObj.Status.Errors,
		"incremental sync should produce no errors")
	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"incremental sync should warn about missing folder metadata")

	require.Contains(t, strings.Join(jobObj.Status.Warnings, "\n"), "missing folder metadata")
	helper.RequireRepoDashboardCount(t, repoName, 2)
}

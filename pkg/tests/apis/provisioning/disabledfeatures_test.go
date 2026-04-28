package provisioning

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_MigrateDisabledByConfiguration(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "test-repository"
	testRepo := common.TestRepo{
		Name:       repo,
		SyncTarget: "instance",
		Workflows:  []string{"write"},
	}
	helper.CreateLocalRepo(t, testRepo)

	spec := provisioning.JobSpec{
		Action: provisioning.JobActionMigrate,
		Migrate: &provisioning.MigrateJobOptions{
			Message: "Test migration",
		},
	}

	job := helper.TriggerJobAndWaitForComplete(t, repo, spec)

	status, found, err := unstructured.NestedMap(job.Object, "status")
	require.NoError(t, err)
	require.True(t, found, "job should have status")

	state, found, err := unstructured.NestedString(status, "state")
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "error", state, "job should have error state")

	message, found, err := unstructured.NestedString(status, "message")
	require.NoError(t, err)
	require.True(t, found)
	require.Contains(t, message, "migrate functionality is disabled by configuration")
}

func TestIntegrationProvisioning_ExportDisabledByConfiguration(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "test-repository"
	testRepo := common.TestRepo{
		Name:       repo,
		SyncTarget: "instance",
		Workflows:  []string{"write"},
	}
	helper.CreateLocalRepo(t, testRepo)

	spec := provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push: &provisioning.ExportJobOptions{
			Folder: "",
			Path:   "",
		},
	}

	job := helper.TriggerJobAndWaitForComplete(t, repo, spec)

	status, found, err := unstructured.NestedMap(job.Object, "status")
	require.NoError(t, err)
	require.True(t, found, "job should have status")

	state, found, err := unstructured.NestedString(status, "state")
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "error", state, "job should have error state")

	message, found, err := unstructured.NestedString(status, "message")
	require.NoError(t, err)
	require.True(t, found)
	require.Contains(t, message, "export functionality is disabled by configuration")
}

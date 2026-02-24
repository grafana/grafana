package provisioning

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_MigrateDisabledByConfiguration(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Run Grafana WITHOUT the export feature flag enabled
	helper := runGrafana(t, withoutExportFeatureFlag)

	// Create a repository
	const repo = "test-repository"
	testRepo := TestRepo{
		Name:   repo,
		Target: "instance",
	}
	helper.CreateRepo(t, testRepo)

	// Try to trigger a migrate job (it should fail)
	spec := provisioning.JobSpec{
		Action: provisioning.JobActionMigrate,
		Migrate: &provisioning.MigrateJobOptions{
			Message: "Test migration",
		},
	}

	// Trigger job and wait for it to complete (will fail)
	job := helper.TriggerJobAndWaitForComplete(t, repo, spec)

	// Check that job failed with the expected error message
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

package provisioning

import (
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
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
	
	job := helper.TriggerJob(t, repo, spec)
	
	// Wait for job and expect it to fail
	job = helper.WaitForJobError(t, job.GetName())
	
	// Check that job failed with the expected error message
	require.Contains(t, job.Status.Message, "migrate functionality is disabled by configuration")
}

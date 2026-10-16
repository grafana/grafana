package provisioning

import (
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// createJobExpectingError posts a job to the repositories/{repo}/jobs subresource
// and returns the API error, asserting the request failed. The shared test env
// disables the provisioningExport feature flag, so migrate and export jobs are
// rejected up front at job creation time.
func createJobExpectingError(t *testing.T, helper *common.ProvisioningTestHelper, repo string, spec provisioning.JobSpec) error {
	t.Helper()

	result := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("jobs").
		Body(common.AsJSON(spec)).
		SetHeader("Content-Type", "application/json").
		Do(t.Context())

	err := result.Error()
	require.Error(t, err, "job creation should be rejected while the feature is disabled")
	return err
}

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

	err := createJobExpectingError(t, helper, repo, spec)
	require.True(t, apierrors.IsBadRequest(err), "expected a bad request, got %v", err)
	require.Contains(t, err.Error(), "migrate jobs require the provisioningExport feature flag")
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

	err := createJobExpectingError(t, helper, repo, spec)
	require.True(t, apierrors.IsBadRequest(err), "expected a bad request, got %v", err)
	require.Contains(t, err.Error(), "push jobs require the provisioningExport feature flag")
}

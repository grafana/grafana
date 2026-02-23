package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_MigrateDisabledByConfiguration(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Run Grafana WITHOUT the export feature flag enabled
	helper := runGrafana(t, withoutExportFeatureFlag)
	ctx := context.Background()

	// Create a repository
	const repo = "test-repository"
	testRepo := TestRepo{
		Name:   repo,
		Target: "instance",
	}

	repository := helper.CreateRepository(ctx, t, testRepo)
	require.NotNil(t, repository)

	// Try to create a migrate job
	job := &unstructured.Unstructured{}
	job.SetUnstructuredContent(map[string]interface{}{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Job",
		"metadata": map[string]interface{}{
			"name":      "test-migrate-job",
			"namespace": "default",
		},
		"spec": map[string]interface{}{
			"action":     "migrate",
			"repository": repo,
			"migrate": map[string]interface{}{
				"message": "Test migration",
			},
		},
	})

	createdJob, err := helper.Jobs.Create(ctx, job, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create job")

	// Wait for job to complete (it should fail)
	job, err = helper.WaitForJob(ctx, createdJob.GetName(), waitTimeoutDefault, waitIntervalDefault)
	require.NoError(t, err, "should be able to get job status")

	// Check that job failed with the expected error
	status, found, err := unstructured.NestedMap(job.Object, "status")
	require.NoError(t, err)
	require.True(t, found, "job should have status")

	result, found, err := unstructured.NestedString(status, "result")
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "error", result, "job should have failed")

	message, found, err := unstructured.NestedString(status, "message")
	require.NoError(t, err)
	require.True(t, found)
	require.Contains(t, message, "migrate functionality is disabled by configuration", "should have configuration disabled error")
}

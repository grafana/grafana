package jobs

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_HistoricJobsPreserveResourceVersion(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "historicjobs-resourceversion-test"
	testRepo := common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies:     map[string]string{},
	}
	helper.CreateLocalRepo(t, testRepo)

	jobSpec := provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	}
	body := common.AsJSON(jobSpec)

	var statusCode int
	result := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("jobs").
		Body(body).
		SetHeader("Content-Type", "application/json").
		Do(t.Context()).StatusCode(&statusCode)
	require.NoError(t, result.Error(), "should be able to create job")
	require.Equal(t, http.StatusAccepted, statusCode)

	obj, err := result.Get()
	require.NoError(t, err)
	job, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok, "expecting unstructured object, but got %T", obj)

	historicJob := helper.AwaitJob(t, job)

	// The historic job is a distinct object with its own resource version, so the original job's
	// resource version is preserved on it as an annotation.
	originalRV := historicJob.GetAnnotations()[jobs.AnnotationJobOriginalResourceVersion]
	require.NotEmpty(t, originalRV, "historic job should preserve the original job's resource version as an annotation")
	require.NotEqual(t, historicJob.GetResourceVersion(), originalRV,
		"preserved resource version should be the original job's, not the historic job's own")
}

package jobs

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_HistoricJobsRecordProgressUpdates(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "historicjobs-progressupdates-test"
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

	// The job status is updated as it is processed, and the running total of those updates is
	// carried over to the historic job so it stays observable after completion.
	progressUpdates, found, err := unstructured.NestedInt64(historicJob.Object, "status", "progressUpdates")
	require.NoError(t, err)
	require.True(t, found, "historic job status should record the number of progress updates")
	require.Positive(t, progressUpdates, "a processed job should have been updated at least once")
}

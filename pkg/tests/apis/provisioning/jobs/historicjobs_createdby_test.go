package jobs

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_HistoricJobsPreserveCreatedBy(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "historicjobs-createdby-test"
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

	jobCreatedBy := job.GetAnnotations()[utils.AnnoKeyCreatedBy]
	require.True(t, strings.HasPrefix(jobCreatedBy, "user:"), "job should be created by a user, got %q", jobCreatedBy)

	historicJob := helper.AwaitJob(t, job)

	require.Equal(t, jobCreatedBy, historicJob.GetAnnotations()[utils.AnnoKeyCreatedBy],
		"historic job should keep the original job's createdBy")
}

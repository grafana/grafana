package historicjob

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioningNATSHistoricJob_CleanedViaListing proves the
// historic-job cleanup path driven by the informer's periodic re-list (LIST),
// not by live NATS notifications. HistoricJob is re-list only, so its cleanup
// controller only acts on what the re-list surfaces.
//
// HistoricJobs are read-only through the API, so they cannot be created
// directly; instead a Job is created directly (referencing a repository that
// does not exist) so it fails fast and is archived into a HistoricJob — no
// repository resource involved. With a short history_expiration, that
// HistoricJob must then be swept by the listing-driven cleanup.
func TestIntegrationProvisioningNATSHistoricJob_CleanedViaListing(t *testing.T) {
	helper := sharedHelper(t)
	ctx := t.Context()

	historicJobs := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default",
		GVR:       provisioning.HistoricJobResourceInfo.GroupVersionResource(),
	})

	// Create a Job directly against a non-existent repository so the driver
	// fails it fast and archives it — producing a HistoricJob without a repo.
	job := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Job",
		"metadata": map[string]any{
			"name":      "nats-historicjob-src",
			"namespace": "default",
			"labels": map[string]any{
				"provisioning.grafana.app/repository": "ghost-repo",
			},
		},
		"spec": map[string]any{
			"action":     "pull",
			"repository": "ghost-repo",
			"pull":       map[string]any{},
		},
	}}
	_, err := helper.Jobs.Resource.Create(ctx, job, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create a job directly")

	// Phase 1: the failed job must be archived into a HistoricJob (confirms the
	// resource actually exists before we assert it is cleaned up).
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		assert.NotEmpty(collect, listHistoricJobs(ctx, collect, historicJobs), "a historic job should be archived")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "the failed job should be archived into a historic job")

	// Phase 2: the re-list-driven cleanup must then remove aged historic jobs.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		assert.Empty(collect, listHistoricJobs(ctx, collect, historicJobs), "historic jobs should be removed by the re-list-driven cleanup")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "historic jobs should be swept by the listing-driven cleanup")
}

func listHistoricJobs(ctx context.Context, collect *assert.CollectT, client *apis.K8sResourceClient) []unstructured.Unstructured {
	list, err := client.Resource.List(ctx, metav1.ListOptions{})
	if !assert.NoError(collect, err, "should list historic jobs") {
		return nil
	}
	return list.Items
}

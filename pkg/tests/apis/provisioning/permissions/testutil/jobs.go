package testutil

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func AwaitSuccess(t *testing.T, h *common.ProvisioningTestHelper, rsp Response) *unstructured.Unstructured {
	t.Helper()
	rsp.Require(t, 202)
	finished := h.AwaitJob(t, &unstructured.Unstructured{Object: rsp.Object(t)})
	require.Equal(t, "success", common.MustNestedString(finished.Object, "status", "state"), "%s", JSON(t, finished.Object))
	return finished
}

func JobCount(t *testing.T, h *common.ProvisioningTestHelper) int {
	t.Helper()
	active, err := h.Jobs.Resource.List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err)
	history := Do(t, h.Org1.Admin, "GET", "v0alpha1", "historicjobs", nil).Require(t, 200).Object(t)
	seen := map[string]bool{}
	// Reconciler jobs are independent of requests under test; deduplicate jobs that finish between the two lists.
	add := func(job *unstructured.Unstructured) {
		if !strings.HasPrefix(job.GetAnnotations()["provisioning.grafana.app/author"], "none-") {
			return
		}
		uid := job.GetLabels()["provisioning.grafana.app/original-uid"]
		if uid == "" {
			uid = string(job.GetUID())
		}
		seen[uid] = true
	}
	for i := range active.Items {
		add(&active.Items[i])
	}
	items, _ := history["items"].([]any)
	for _, item := range items {
		add(&unstructured.Unstructured{Object: item.(map[string]any)})
	}
	return len(seen)
}

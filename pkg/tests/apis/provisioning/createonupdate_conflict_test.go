package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_ConflictOnConditionalUpdateOfMissing exercises, through the real
// apiserver and unified storage, the list->update race the job queue hits: a conditional
// update (an object carrying a resourceVersion) targets a name that does not exist, so
// create-on-update kicks in — but the resourceVersion means it can never legitimately be a
// create. The client must observe a 409 Conflict (so it re-reads and retries), proving the
// fix end-to-end rather than only at the storage boundary. It must NOT resurrect/create the
// object nor fail with the opaque "resourceVersion should not be set on objects to be created"
// 500 the old code produced.
//
// Repositories are a unified-storage-backed, create-on-update resource (genericStrategy,
// AllowCreateOnUpdate=true) — the same storage class as provisioning jobs, whose claim path
// originally surfaced this bug.
func TestIntegrationProvisioning_ConflictOnConditionalUpdateOfMissing(t *testing.T) {
	helper := sharedHelper(t)

	// Render a valid local repository object WITHOUT creating it, so its name never exists.
	obj := helper.RenderObject(t, common.TestdataPath("local.json.tmpl"), common.TestRepo{
		Name:          "conflict-ghost",
		SyncTarget:    "instance",
		Path:          helper.ProvisioningPath,
		WorkflowsJSON: "[]",
	})

	// Stamp a resourceVersion so the write is a conditional (optimistic-concurrency) update
	// rather than an unconditional upsert.
	obj.SetResourceVersion("99999")

	// Update a name that was never created. create-on-update on a missing key with a
	// resourceVersion set must return Conflict.
	_, err := helper.Repositories.Resource.Update(context.Background(), obj, metav1.UpdateOptions{})
	require.Error(t, err)
	statusErr := helper.AsStatusError(err)
	require.Equal(t, metav1.StatusReasonConflict, statusErr.Status().Reason,
		"a conditional update against a missing object must surface as Conflict")
}

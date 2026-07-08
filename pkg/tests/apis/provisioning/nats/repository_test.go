package nats

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioningNATS_RepositoryCreateReconciledOverNATS proves the
// repository controller is driven by a live NATS notification: the repository
// is created and must be reconciled to healthy within liveDeliveryWait. The
// repository controller's only event source is the informer, whose re-list is
// 10 minutes out (WithNATS) and whose initial list predates this resource, so a
// reconcile this fast can only have come from the ADDED notification.
func TestIntegrationProvisioningNATS_RepositoryCreateReconciledOverNATS(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "nats-repo-create"
	createLocalRepo(t, helper, repo)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repo, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		observedGeneration, found, err := unstructured.NestedInt64(obj.Object, "status", "observedGeneration")
		assert.NoError(collect, err)
		assert.True(collect, found, "controller should set status.observedGeneration")
		assert.Greater(collect, observedGeneration, int64(0), "observedGeneration should be set by the controller")

		healthy, found, err := unstructured.NestedBool(obj.Object, "status", "health", "healthy")
		assert.NoError(collect, err)
		assert.True(collect, found, "controller should populate status.health")
		assert.True(collect, healthy, "repository should be healthy")
	}, liveDeliveryWait, liveDeliveryTick, "repository should be reconciled to healthy over NATS within %s", liveDeliveryWait)
}

// TestIntegrationProvisioningNATS_RepositoryUpdateReconciledOverNATS proves the
// controller also reacts to update events over NATS: after the repository is
// healthy, aging its health timestamp (a status update) must trigger a fresh
// health check that advances status.health.checked within liveDeliveryWait —
// again far sooner than the 10-minute re-list could explain.
func TestIntegrationProvisioningNATS_RepositoryUpdateReconciledOverNATS(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "nats-repo-update"
	ctx := t.Context()
	createLocalRepo(t, helper, repo)

	// Wait for the initial healthy reconcile so we have a baseline timestamp.
	var before int64
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		checked, ok := repositoryHealthChecked(ctx, collect, helper, repo)
		if assert.True(collect, ok, "repository should have a health checked timestamp") {
			before = checked
		}
	}, liveDeliveryWait, liveDeliveryTick, "repository should first become healthy over NATS")

	// Age the health timestamp; the update event flows through the NATS informer
	// and the controller re-runs the health check.
	helper.TriggerRepositoryReconciliation(t, repo)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		checked, ok := repositoryHealthChecked(ctx, collect, helper, repo)
		if assert.True(collect, ok) {
			assert.Greater(collect, checked, before, "controller should re-check health after the update event")
		}
	}, liveDeliveryWait, liveDeliveryTick, "repository health should be re-checked over NATS within %s", liveDeliveryWait)
}

func repositoryHealthChecked(ctx context.Context, collect *assert.CollectT, helper *common.ProvisioningTestHelper, repo string) (int64, bool) {
	obj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
	if !assert.NoError(collect, err, "should read back the repository") {
		return 0, false
	}
	checked, found, err := unstructured.NestedInt64(obj.Object, "status", "health", "checked")
	assert.NoError(collect, err)
	return checked, found
}

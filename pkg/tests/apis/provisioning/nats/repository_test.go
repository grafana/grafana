package nats

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioningNATS_RepositoryControllerReconciles verifies the
// repository controller reacts to a Repository create event delivered over the
// NATS-backed informer: it runs the health check and writes the result back to
// status. CreateLocalRepo blocks on WaitForHealthyRepository, so this only
// passes if the controller processed the event and set status.health.healthy.
func TestIntegrationProvisioningNATS_RepositoryControllerReconciles(t *testing.T) {
	helper := sharedHelper(t)
	ctx := t.Context()

	const repo = "nats-repo-reconcile"

	// Blocks until the controller marks the repository healthy.
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	obj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
	require.NoError(t, err, "should read back the repository")

	// The controller advances observedGeneration once it has reconciled the spec.
	observedGeneration, found, err := unstructured.NestedInt64(obj.Object, "status", "observedGeneration")
	require.NoError(t, err)
	require.True(t, found, "controller should set status.observedGeneration")
	require.Greater(t, observedGeneration, int64(0), "observedGeneration should be set by the controller")

	// A health check must have run (non-zero checked timestamp, healthy=true).
	healthy, found, err := unstructured.NestedBool(obj.Object, "status", "health", "healthy")
	require.NoError(t, err)
	require.True(t, found, "controller should populate status.health")
	require.True(t, healthy, "repository should be healthy after reconcile over NATS")
}

// TestIntegrationProvisioningNATS_RepositoryReconcilesOnUpdate verifies the
// controller also reacts to update events over NATS: after the repository is
// healthy, aging its health timestamp (an update to the status subresource)
// triggers a fresh reconcile that advances status.health.checked.
func TestIntegrationProvisioningNATS_RepositoryReconcilesOnUpdate(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "nats-repo-update"

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	before := repositoryHealthChecked(t, helper, repo)

	// Age the health timestamp; the update event flows through the NATS informer
	// and the controller re-runs the health check.
	helper.TriggerRepositoryReconciliation(t, repo)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		checked := repositoryHealthChecked(t, helper, repo)
		assert.Greater(collect, checked, before, "controller should re-check health after the update event")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "repository health should be re-checked over NATS")
}

func repositoryHealthChecked(t *testing.T, helper *common.ProvisioningTestHelper, repo string) int64 {
	t.Helper()
	obj, err := helper.Repositories.Resource.Get(t.Context(), repo, metav1.GetOptions{})
	require.NoError(t, err, "should read back the repository")
	checked, found, err := unstructured.NestedInt64(obj.Object, "status", "health", "checked")
	require.NoError(t, err)
	require.True(t, found, "repository should have a health checked timestamp")
	return checked
}

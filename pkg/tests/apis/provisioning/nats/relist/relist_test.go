package relist

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioningNATSReList_RepositoryReconciledViaReList proves the
// re-list fallback reconciles a newly-created repository. Nothing publishes
// watch notifications in this package, and the informer's initial list ran at
// startup before this repo existed, so the controller can only have observed
// the repository through the periodic re-list. It must still reach healthy.
func TestIntegrationProvisioningNATSReList_RepositoryReconciledViaReList(t *testing.T) {
	helper := sharedHelper(t)
	ctx := t.Context()

	const repo = "nats-relist-create"
	createLocalRepo(t, helper, repo)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		observedGeneration, found, err := unstructured.NestedInt64(obj.Object, "status", "observedGeneration")
		assert.NoError(collect, err)
		assert.True(collect, found, "controller should set status.observedGeneration")
		assert.Greater(collect, observedGeneration, int64(0))

		healthy, found, err := unstructured.NestedBool(obj.Object, "status", "health", "healthy")
		assert.NoError(collect, err)
		assert.True(collect, found && healthy, "repository should be healthy")
	}, reListWait, reListTick, "repository should be reconciled to healthy via the re-list within %s", reListWait)
}

// TestIntegrationProvisioningNATSReList_RepositoryReCheckedViaReList proves the
// re-list also picks up updates: after the repository is healthy, aging its
// health timestamp must trigger a fresh health check on a subsequent re-list,
// advancing status.health.checked — again with no live notification in play.
func TestIntegrationProvisioningNATSReList_RepositoryReCheckedViaReList(t *testing.T) {
	helper := sharedHelper(t)
	ctx := t.Context()

	const repo = "nats-relist-update"
	createLocalRepo(t, helper, repo)

	var before int64
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		checked, ok := repositoryHealthChecked(ctx, collect, helper, repo)
		if assert.True(collect, ok, "repository should have a health checked timestamp") {
			before = checked
		}
	}, reListWait, reListTick, "repository should first become healthy via the re-list")

	helper.TriggerRepositoryReconciliation(t, repo)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		checked, ok := repositoryHealthChecked(ctx, collect, helper, repo)
		if assert.True(collect, ok) {
			assert.Greater(collect, checked, before, "controller should re-check health on a re-list after the update")
		}
	}, reListWait, reListTick, "repository health should be re-checked via the re-list within %s", reListWait)
}

// createLocalRepo creates a sync-disabled, folderless local repository without
// waiting for it to become healthy — the caller asserts the reconcile itself.
func createLocalRepo(t *testing.T, helper *common.ProvisioningTestHelper, name string) {
	t.Helper()
	repo := helper.RenderObject(t, common.TestdataPath("local.json.tmpl"), common.TestRepo{
		Name:          name,
		SyncTarget:    "folderless",
		Path:          helper.ProvisioningPath,
		WorkflowsJSON: "[]",
	})
	_, err := helper.Repositories.Resource.Create(t.Context(), repo, metav1.CreateOptions{})
	require.NoError(t, err, "failed to create local repository %q", name)
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

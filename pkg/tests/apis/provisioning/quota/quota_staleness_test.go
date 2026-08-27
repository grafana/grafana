package quota

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_RepositoryUsesStaleQuotaWhenRefreshFails(t *testing.T) {
	helper := sharedHelper(t)
	initialQuota := provisioning.QuotaStatus{
		MaxRepositories:           5,
		MaxResourcesPerRepository: 100,
	}
	helper.SetQuotaStatus(initialQuota)

	const repoName = "stale-quota-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repoName,
		SyncTarget: "folder",
	})

	obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
	require.NoError(t, err)
	repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
	require.Equal(t, initialQuota.MaxRepositories, repo.Status.Quota.MaxRepositories)
	require.Equal(t, initialQuota.MaxResourcesPerRepository, repo.Status.Quota.MaxResourcesPerRepository)
	require.Equal(t, repo.Generation, repo.Status.ObservedGeneration)
	require.Zero(t, repo.Status.Quota.StaleSince)

	lookupErr := apierrors.NewInternalError(errors.New("quota service returned 500"))
	helper.SetQuotaError(lookupErr)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
		assert.Equal(collect, initialQuota.MaxRepositories, repo.Status.Quota.MaxRepositories)
		assert.Equal(collect, initialQuota.MaxResourcesPerRepository, repo.Status.Quota.MaxResourcesPerRepository)
		assert.Equal(collect, repo.Generation, repo.Status.ObservedGeneration)
		assert.NotZero(collect, repo.Status.Quota.StaleSince)
	}, 2*common.WaitTimeoutDefault, common.WaitIntervalDefault)

	refreshedQuota := provisioning.QuotaStatus{
		MaxRepositories:           8,
		MaxResourcesPerRepository: 200,
	}
	helper.SetQuotaStatus(refreshedQuota)
	helper.SetQuotaError(nil)
	helper.TriggerRepositoryReconciliation(t, repoName)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
		assert.Equal(collect, refreshedQuota.MaxRepositories, repo.Status.Quota.MaxRepositories)
		assert.Equal(collect, refreshedQuota.MaxResourcesPerRepository, repo.Status.Quota.MaxResourcesPerRepository)
		assert.Zero(collect, repo.Status.Quota.StaleSince)

		quota, found, nestedErr := nestedField(obj.Object, "status", "quota")
		if !assert.NoError(collect, nestedErr) || !assert.True(collect, found) {
			return
		}
		quotaMap, ok := quota.(map[string]interface{})
		if assert.True(collect, ok) {
			_, found = quotaMap["staleSince"]
			assert.False(collect, found, "staleSince should be removed after quota refresh recovers")
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
}

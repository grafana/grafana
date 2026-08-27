package quota

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

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
		SkipSync:   true,
	})

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		assert.NoError(collect, err)
		repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
		assert.Equal(collect, initialQuota.MaxRepositories, repo.Status.Quota.MaxRepositories)
		assert.Equal(collect, initialQuota.MaxResourcesPerRepository, repo.Status.Quota.MaxResourcesPerRepository)
		assert.Equal(collect, repo.Generation, repo.Status.ObservedGeneration)
		assert.Zero(collect, repo.Status.Quota.StaleSince)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	repoObj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
	require.NoError(t, err)
	lookupErr := apierrors.NewInternalError(errors.New("quota service returned 500"))
	helper.SetQuotaError(lookupErr)

	const updatedTitle = "Updated while quota lookup fails"
	require.NoError(t, unstructured.SetNestedField(repoObj.Object, updatedTitle, "spec", "title"))
	updatedObj, err := helper.Repositories.Resource.Update(t.Context(), repoObj, metav1.UpdateOptions{FieldValidation: "Strict"})
	require.NoError(t, err)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		assert.NoError(collect, err)
		repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
		assert.Equal(collect, updatedTitle, repo.Spec.Title)
		assert.Equal(collect, initialQuota.MaxRepositories, repo.Status.Quota.MaxRepositories)
		assert.Equal(collect, initialQuota.MaxResourcesPerRepository, repo.Status.Quota.MaxResourcesPerRepository)
		assert.Equal(collect, updatedObj.GetGeneration(), repo.Status.ObservedGeneration)
		assert.NotZero(collect, repo.Status.Quota.StaleSince)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	newRepo := helper.RenderObject(t, common.TestdataPath("local.json.tmpl"), map[string]any{
		"Name":          "new-repo-during-quota-error",
		"SyncEnabled":   false,
		"SyncTarget":    "folder",
		"Path":          helper.ProvisioningPath,
		"WorkflowsJSON": `[]`,
	})
	_, err = helper.Repositories.Resource.Create(t.Context(), newRepo, metav1.CreateOptions{FieldValidation: "Strict"})
	require.ErrorContains(t, err, "failed to get quota status")

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

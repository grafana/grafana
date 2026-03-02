package provisioning

import (
	"fmt"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_NamespaceRepositoryQuota(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)

	repo1Path := filepath.Join(helper.ProvisioningPath, "repo1")
	repo2Path := filepath.Join(helper.ProvisioningPath, "repo2")

	// --- Step 1: create 2 repos with unlimited quota  ---------
	helper.SetQuotaStatus(provisioning.QuotaStatus{MaxRepositories: 0})
	helper.CreateRepo(t, TestRepo{
		Name:                   "ns-quota-repo1",
		Path:                   repo1Path,
		Target:                 "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})
	helper.CreateRepo(t, TestRepo{
		Name:                   "ns-quota-repo2",
		Path:                   repo2Path,
		Target:                 "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	helper.WaitForHealthyRepository(t, "ns-quota-repo1")
	helper.WaitForHealthyRepository(t, "ns-quota-repo2")
	// waitForNamespaceQuota(t, helper, "ns-quota-repo1", provisioning.ReasonQuotaUnlimited)
	//waitForNamespaceQuota(t, helper, "ns-quota-repo2", provisioning.ReasonQuotaUnlimited)

	// --- Step 2: lower quota to 1 — both repos exceed the limit --------
	helper.SetQuotaStatus(provisioning.QuotaStatus{MaxRepositories: 1})
	helper.TriggerRepositoryReconciliation(t, "ns-quota-repo1")
	helper.TriggerRepositoryReconciliation(t, "ns-quota-repo2")

	waitForUnhealthyWithNamespaceQuota(t, helper, "ns-quota-repo1", provisioning.ReasonQuotaExceeded)
	waitForUnhealthyWithNamespaceQuota(t, helper, "ns-quota-repo2", provisioning.ReasonQuotaExceeded)

	// --- Step 3: delete one repo — remaining repo recovers -------------
	err := helper.Repositories.Resource.Delete(t.Context(), "ns-quota-repo2", metav1.DeleteOptions{})
	require.NoError(t, err)

	helper.TriggerRepositoryReconciliation(t, "ns-quota-repo1")
	waitForHealthyWithNamespaceQuota(t, helper, "ns-quota-repo1", provisioning.ReasonQuotaReached)

	// --- Step 4: set quota back to unlimited — repo fully recovers -----
	helper.SetQuotaStatus(provisioning.QuotaStatus{MaxRepositories: 0})

	helper.TriggerRepositoryReconciliation(t, "ns-quota-repo1")
	waitForHealthyWithNamespaceQuota(t, helper, "ns-quota-repo1", provisioning.ReasonQuotaUnlimited)
}

// waitForUnhealthyWithNamespaceQuota waits for a repo to become unhealthy and
// its NamespaceQuota condition to match.
func waitForUnhealthyWithNamespaceQuota(t *testing.T, helper *provisioningTestHelper, repoName, expectedReason string) {
	t.Helper()
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		fmt.Printf("Waiting for unhealthy with namespace quota for repo %s\n", repoName)
		repoObj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		repo := unstructuredToRepository(t, repoObj)
		assert.False(collect, repo.Status.Health.Healthy, "repo %s should be unhealthy", repoName)
		cond := findCondition(repo.Status.Conditions, provisioning.ConditionTypeNamespaceQuota)
		fmt.Printf("NamespaceQuota condition: %+v\n", cond)
		if !assert.NotNil(collect, cond, "NamespaceQuota condition not found on %s", repoName) {
			return
		}
		assert.Equal(collect, expectedReason, cond.Reason)
	}, waitTimeoutDefault, waitIntervalDefault)
}

// waitForHealthyWithNamespaceQuota waits for a repo to become healthy and its
// NamespaceQuota condition to match.
func waitForHealthyWithNamespaceQuota(t *testing.T, helper *provisioningTestHelper, repoName, expectedReason string) {
	t.Helper()
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		repoObj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		repo := unstructuredToRepository(t, repoObj)
		assert.True(collect, repo.Status.Health.Healthy, "repo %s should be healthy", repoName)
		cond := findCondition(repo.Status.Conditions, provisioning.ConditionTypeNamespaceQuota)
		if !assert.NotNil(collect, cond, "NamespaceQuota condition not found on %s", repoName) {
			return
		}
		assert.Equal(collect, expectedReason, cond.Reason)
	}, waitTimeoutDefault, waitIntervalDefault)
}

package provisioning

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_NamespaceRepositoryQuota(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t)

	const (
		repo1Name = "ns-quota-repo1"
		repo2Name = "ns-quota-repo2"
	)

	repo1Path := filepath.Join(helper.ProvisioningPath, "repo1")
	repo2Path := filepath.Join(helper.ProvisioningPath, "repo2")

	// --- Step 1: create 2 repos with unlimited quota  ---------
	helper.SetQuotaStatus(provisioning.QuotaStatus{MaxRepositories: 0})
	helper.CreateRepo(t, common.TestRepo{
		Name:                   repo1Name,
		Path:                   repo1Path,
		Target:                 "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})
	helper.CreateRepo(t, common.TestRepo{
		Name:                   repo2Name,
		Path:                   repo2Path,
		Target:                 "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	waitForHealthyWithNamespaceQuota(t, helper, repo1Name, provisioning.ReasonQuotaUnlimited)
	waitForHealthyWithNamespaceQuota(t, helper, repo2Name, provisioning.ReasonQuotaUnlimited)

	// --- Step 2: lower quota to 1 — both repos exceed the limit --------
	helper.SetQuotaStatus(provisioning.QuotaStatus{MaxRepositories: 1})
	helper.TriggerRepositoryReconciliation(t, repo1Name)
	helper.TriggerRepositoryReconciliation(t, repo2Name)

	waitForUnhealthyWithNamespaceQuota(t, helper, repo1Name, provisioning.ReasonQuotaExceeded)
	waitForUnhealthyWithNamespaceQuota(t, helper, repo2Name, provisioning.ReasonQuotaExceeded)

	// --- Step 3: delete one repo — remaining repo recovers -------------
	err := helper.Repositories.Resource.Delete(t.Context(), repo2Name, metav1.DeleteOptions{})
	require.NoError(t, err)

	helper.TriggerRepositoryReconciliation(t, repo1Name)
	waitForHealthyWithNamespaceQuota(t, helper, repo1Name, provisioning.ReasonQuotaReached)

	// --- Step 4: set quota back to unlimited — repo fully recovers -----
	helper.SetQuotaStatus(provisioning.QuotaStatus{MaxRepositories: 0})

	helper.TriggerRepositoryReconciliation(t, repo1Name)
	waitForHealthyWithNamespaceQuota(t, helper, repo1Name, provisioning.ReasonQuotaUnlimited)
}

// waitForUnhealthyWithNamespaceQuota waits for a repo to become unhealthy and
// its NamespaceQuota condition to match.
func waitForUnhealthyWithNamespaceQuota(t *testing.T, helper *common.ProvisioningTestHelper, repoName, expectedReason string) {
	t.Helper()
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		t.Logf("Waiting for unhealthy with namespace quota for repo %s", repoName)
		repoObj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		repo := common.UnstructuredToRepository(t, repoObj)
		assert.False(collect, repo.Status.Health.Healthy, "repo %s should be unhealthy", repoName)
		cond := common.FindCondition(repo.Status.Conditions, provisioning.ConditionTypeNamespaceQuota)
		if !assert.NotNil(collect, cond, "NamespaceQuota condition not found on %s", repoName) {
			return
		}
		assert.Equal(collect, expectedReason, cond.Reason)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
}

// waitForHealthyWithNamespaceQuota waits for a repo to become healthy and its
// NamespaceQuota condition to match.
func waitForHealthyWithNamespaceQuota(t *testing.T, helper *common.ProvisioningTestHelper, repoName, expectedReason string) {
	t.Helper()
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		t.Logf("Waiting for healthy with namespace quota for repo %s", repoName)
		repoObj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		repo := common.UnstructuredToRepository(t, repoObj)
		assert.True(collect, repo.Status.Health.Healthy, "repo %s should be healthy", repoName)
		cond := common.FindCondition(repo.Status.Conditions, provisioning.ConditionTypeNamespaceQuota)
		if !assert.NotNil(collect, cond, "NamespaceQuota condition not found on %s", repoName) {
			return
		}
		assert.Equal(collect, expectedReason, cond.Reason)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
}

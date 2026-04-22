package quota

import (
	"context"
	"encoding/base64"
	"path/filepath"
	"testing"
	"time"

	"encoding/json"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_NamespaceRepositoryQuota(t *testing.T) {
	helper := sharedHelper(t)

	const (
		repo1Name = "ns-quota-repo1"
		repo2Name = "ns-quota-repo2"
	)

	repo1Path := filepath.Join(helper.ProvisioningPath, "repo1")
	repo2Path := filepath.Join(helper.ProvisioningPath, "repo2")

	// --- Step 1: create 2 repos with unlimited quota  ---------
	helper.SetQuotaStatus(provisioning.QuotaStatus{MaxRepositories: 0})
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo1Name,
		LocalPath:              repo1Path,
		SyncTarget:             "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo2Name,
		LocalPath:              repo2Path,
		SyncTarget:             "folder",
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
		repo := common.MustFromUnstructured[provisioning.Repository](t, repoObj)
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
		repo := common.MustFromUnstructured[provisioning.Repository](t, repoObj)
		assert.True(collect, repo.Status.Health.Healthy, "repo %s should be healthy", repoName)
		cond := common.FindCondition(repo.Status.Conditions, provisioning.ConditionTypeNamespaceQuota)
		if !assert.NotNil(collect, cond, "NamespaceQuota condition not found on %s", repoName) {
			return
		}
		assert.Equal(collect, expectedReason, cond.Reason)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
}

// TestIntegrationProvisioning_HealthAndTokenRefreshWhileOverNamespaceQuota verifies
// that auth token refresh and health checks are not skipped when a repository is
// blocked due to namespace quota being exceeded.
func TestIntegrationProvisioning_HealthAndTokenRefreshWhileOverNamespaceQuota(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(common.TestGithubPrivateKeyPEM))

	const (
		connName  = "ns-quota-token-conn"
		repoName1 = "ns-quota-token-repo1"
		repoName2 = "ns-quota-token-repo2"
	)

	// --- Step 1: create a GitHub connection backed by the mocked GitHub API ---
	conn := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      connName,
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "NS Quota Token Refresh Conn",
			"type":  "github",
			"github": map[string]any{
				"appID":          "123456",
				"installationID": "789012",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": privateKeyBase64,
			},
		},
	}}

	_, err := helper.CreateGithubConnection(t, ctx, conn)
	require.NoError(t, err, "failed to create GitHub connection")

	// Wait for the connection itself to be reconciled (token acquired).
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		obj, err := helper.Connections.Resource.Get(ctx, connName, metav1.GetOptions{})
		if !assert.NoError(c, err) {
			return
		}
		connObj := common.MustFromUnstructured[provisioning.Connection](t, obj)
		assert.NotEqual(c, int64(0), connObj.Status.ObservedGeneration,
			"connection should be reconciled at least once")
		assert.False(c, connObj.Secure.Token.IsZero(),
			"connection should have a token after initial reconciliation")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "connection %s should be reconciled with token", connName)

	// --- Step 2: create two GitHub repos linked to the connection -------------
	// sync.enabled=false avoids triggering actual Git operations; the connection
	// still drives token generation for the repo.
	for _, name := range []string{repoName1, repoName2} {
		repoObj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"name":      name,
				"namespace": "default",
				"finalizers": []string{
					"remove-orphan-resources",
					"cleanup",
				},
			},
			"spec": map[string]any{
				"title": name,
				"type":  "github",
				"github": map[string]any{
					"url":    "https://github.com/some/url",
					"branch": "main",
				},
				"sync": map[string]any{
					"enabled": false,
					"target":  "folder",
				},
				"connection": map[string]any{
					"name": connName,
				},
			},
		}}
		_, err = helper.Repositories.Resource.Create(ctx, repoObj, metav1.CreateOptions{})
		require.NoError(t, err, "failed to create repository %s", name)
	}

	// Wait for both repos to receive an initial token from the connection.
	for _, name := range []string{repoName1, repoName2} {
		name := name
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			obj, err := helper.Repositories.Resource.Get(ctx, name, metav1.GetOptions{})
			if !assert.NoError(c, err) {
				return
			}
			r := common.MustFromUnstructured[provisioning.Repository](t, obj)
			assert.False(c, r.Secure.Token.IsZero(),
				"repo %s should have a token after initial reconciliation", name)
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
			"repo %s should be reconciled with an initial token", name)
	}

	// --- Step 3: lower quota to 1 — both repos exceed the limit ---------------
	helper.SetQuotaStatus(provisioning.QuotaStatus{MaxRepositories: 1})
	helper.TriggerRepositoryReconciliation(t, repoName1)
	helper.TriggerRepositoryReconciliation(t, repoName2)

	waitForUnhealthyWithNamespaceQuota(t, helper, repoName1, provisioning.ReasonQuotaExceeded)

	// --- Step 4: manufacture a near-expiry token state on repo1 ---------------
	// Simulate the scenario where the repo is still blocked but its token is
	// about to expire.
	//
	// The controller reconciler runs concurrently and may update the repo's
	// status between our Get and UpdateStatus, causing optimistic-locking
	// conflicts. On fast backends (SQLite) the reconciler outpaces even
	// tight retry loops. A merge patch on the status subresource avoids
	// this entirely — it doesn't require a specific resourceVersion, so it
	// can never conflict.
	now := time.Now()
	staledHealthChecked := now.Add(-2 * time.Minute).UnixMilli()
	staledTokenLastUpdated := now.Add(-1 * time.Hour).UnixMilli()

	// Token lastUpdated far in the past (not "recently created") and expiration
	// soon (within the 2*resyncInterval+10s refresh buffer).
	// Age the health.checked beyond recentUnhealthyDuration (1 min) so the
	// health checker considers it stale.
	statusPatch, err := json.Marshal(map[string]any{
		"status": map[string]any{
			"token": map[string]any{
				"lastUpdated": staledTokenLastUpdated,
				"expiration":  now.Add(30 * time.Second).UnixMilli(),
			},
			"health": map[string]any{
				"checked": staledHealthChecked,
			},
		},
	})
	require.NoError(t, err)
	_, err = helper.Repositories.Resource.Patch(ctx, repoName1,
		types.MergePatchType, statusPatch, metav1.PatchOptions{}, "status")
	require.NoError(t, err, "failed to patch repo1 status with near-expiry token")

	// --- Step 5: verify health check AND token refresh happened, repo still blocked
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(ctx, repoName1, metav1.GetOptions{})
		if !assert.NoError(c, err) {
			return
		}
		r := common.MustFromUnstructured[provisioning.Repository](t, obj)

		// Repository must still be blocked by the namespace quota.
		cond := common.FindCondition(r.Status.Conditions, provisioning.ConditionTypeNamespaceQuota)
		if !assert.NotNil(c, cond, "NamespaceQuota condition should exist") {
			return
		}
		assert.Equal(c, provisioning.ReasonQuotaExceeded, cond.Reason,
			"repo should still be quota-blocked after token refresh")

		// Health check ran: checked timestamp advanced beyond the staled value.
		assert.Greater(c, r.Status.Health.Checked, staledHealthChecked,
			"health.checked should be updated even when the repo is over namespace quota")

		// Token was refreshed: lastUpdated advanced beyond the staled value.
		assert.Greater(c, r.Status.Token.LastUpdated, staledTokenLastUpdated,
			"token should be refreshed even when the repo is over namespace quota")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"health check and token refresh must run for quota-blocked repositories")
}

package quota

import (
	"context"
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_AuthenticationConditionSurvivesQuotaOverride is the
// end-to-end regression for the previously-broken case: a repository whose
// health check detects an authentication failure while the namespace is over
// quota. The quota override wins the single Ready reason (QuotaExceeded), but the
// dedicated Authentication condition must keep reporting the auth failure so a
// consumer (e.g. force-delete) can still tell the credentials are the problem.
func TestIntegrationProvisioning_AuthenticationConditionSurvivesQuotaOverride(t *testing.T) {
	helper := sharedHelper(t)

	const (
		authRepo   = "auth-quota-auth-repo"
		fillerRepo = "auth-quota-filler-repo"
	)

	// --- Step 1: unlimited quota; create a git repo with a bad token plus a
	// second repo so the namespace holds two repositories. -------------------
	helper.SetQuotaStatus(provisioning.QuotaStatus{MaxRepositories: 0})

	authRepoConfig := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Repository",
		"metadata": map[string]any{
			"name":      authRepo,
			"namespace": "default",
			"finalizers": []string{
				"remove-orphan-resources",
				"cleanup",
			},
		},
		"spec": map[string]any{
			"title": "Auth-failed repo over quota",
			"type":  "git",
			"git": map[string]any{
				"url":    "https://github.com/grafana/grafana-git-sync-demo.git",
				"branch": "integration-test",
			},
			"workflows": []string{"write"},
			"sync": map[string]any{
				"enabled":         false,
				"target":          "folder",
				"intervalSeconds": 10,
			},
		},
		"secure": map[string]any{
			"token": map[string]any{
				// Garbage token → 401 on the authorization probe → the health check
				// records an authentication failure.
				"create": base64.StdEncoding.EncodeToString([]byte("ghp_invalid_authentication_will_fail")),
			},
		},
	}}
	_, err := helper.Repositories.Resource.Create(t.Context(), authRepoConfig, metav1.CreateOptions{})
	require.NoError(t, err, "auth repo creation should succeed")
	t.Cleanup(func() {
		_ = helper.Repositories.Resource.Delete(context.Background(), authRepo, metav1.DeleteOptions{})
	})

	// A second (healthy, local) repository keeps the namespace at two repos so
	// lowering the quota to 1 puts it over the limit.
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       fillerRepo,
		SyncTarget: "folder",
		SkipSync:   true,
	})

	// --- Step 2: before touching quota, the auth failure is visible on both
	// Ready and the dedicated Authentication condition. ----------------------
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), authRepo, metav1.GetOptions{})
		if !assert.NoError(c, err) {
			return
		}
		r := common.MustFromUnstructured[provisioning.Repository](t, obj)
		ready := common.FindCondition(r.Status.Conditions, provisioning.ConditionTypeReady)
		if assert.NotNil(c, ready, "Ready condition should exist") {
			assert.Equal(c, provisioning.ReasonAuthenticationFailed, ready.Reason)
		}
		auth := common.FindCondition(r.Status.Conditions, provisioning.ConditionTypeAuthentication)
		if assert.NotNil(c, auth, "Authentication condition should exist") {
			assert.Equal(c, metav1.ConditionFalse, auth.Status)
			assert.Equal(c, provisioning.ReasonAuthenticationFailed, auth.Reason)
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"auth repo should settle on AuthenticationFailed on both Ready and Authentication")

	// --- Step 3: lower quota to 1 — both repos now exceed the limit. --------
	helper.SetQuotaStatus(provisioning.QuotaStatus{MaxRepositories: 1})
	helper.TriggerRepositoryReconciliation(t, authRepo)

	// --- Step 4: the quota override wins Ready, but the Authentication
	// condition still reports the credential failure. ------------------------
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), authRepo, metav1.GetOptions{})
		if !assert.NoError(c, err) {
			return
		}
		r := common.MustFromUnstructured[provisioning.Repository](t, obj)

		ready := common.FindCondition(r.Status.Conditions, provisioning.ConditionTypeReady)
		if !assert.NotNil(c, ready, "Ready condition should exist") {
			return
		}
		assert.Equal(c, provisioning.ReasonQuotaExceeded, ready.Reason,
			"quota override should win the single Ready reason")

		auth := common.FindCondition(r.Status.Conditions, provisioning.ConditionTypeAuthentication)
		if !assert.NotNil(c, auth, "Authentication condition must survive the quota override") {
			return
		}
		assert.Equal(c, metav1.ConditionFalse, auth.Status)
		assert.Equal(c, provisioning.ReasonAuthenticationFailed, auth.Reason)
		assert.Equal(c, r.Generation, auth.ObservedGeneration,
			"controller should have observed the current generation")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"Authentication=AuthenticationFailed must survive while Ready reports QuotaExceeded")
}

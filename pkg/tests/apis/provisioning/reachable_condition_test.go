package provisioning

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

// TestIntegrationProvisioning_ReachableCondition verifies the dedicated Reachable
// condition the controller now writes alongside Ready:
//   - a healthy repository reports Reachable=True/Available;
//   - a repository whose credentials fail the health check reports
//     Reachable=False/AuthenticationFailed.
//
// The co-occurrence case (the failure surviving a quota override on Ready) is
// covered by an integration test in the quota package, which needs namespace
// quota manipulation.
func TestIntegrationProvisioning_ReachableCondition(t *testing.T) {
	helper := sharedHelper(t)

	t.Run("healthy repository is Reachable", func(t *testing.T) {
		const repo = "reachable-healthy"
		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			SkipSync:   true,
		})
		t.Cleanup(func() {
			_ = helper.Repositories.Resource.Delete(context.Background(), repo, metav1.DeleteOptions{})
		})

		require.EventuallyWithT(t, func(c *assert.CollectT) {
			obj, err := helper.Repositories.Resource.Get(t.Context(), repo, metav1.GetOptions{})
			if !assert.NoError(c, err) {
				return
			}
			r := common.MustFromUnstructured[provisioning.Repository](t, obj)
			assert.True(c, r.Status.Health.Healthy, "repository should be healthy")
			reachable := common.FindCondition(r.Status.Conditions, provisioning.ConditionTypeReachable)
			if !assert.NotNil(c, reachable, "Reachable condition should exist") {
				return
			}
			assert.Equal(c, metav1.ConditionTrue, reachable.Status)
			assert.Equal(c, provisioning.ReasonAvailable, reachable.Reason)
			assert.Equal(c, r.Generation, reachable.ObservedGeneration,
				"controller should have observed the current generation")
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
			"healthy repository should report Reachable=True/Available")
	})

	t.Run("credential failure is Reachable=False/AuthenticationFailed", func(t *testing.T) {
		const repo = "reachable-auth-failed"
		repoConfig := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"name":      repo,
				"namespace": "default",
				"finalizers": []string{
					"remove-orphan-resources",
					"cleanup",
				},
			},
			"spec": map[string]any{
				"title": "Reachable condition auth-failed repo",
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
					// A garbage token fails the authorization probe (401) before any
					// write-permission check, so the health check finds the remote
					// unreachable.
					"create": base64.StdEncoding.EncodeToString([]byte("ghp_invalid_authentication_will_fail")),
				},
			},
		}}

		_, err := helper.Repositories.Resource.Create(t.Context(), repoConfig, metav1.CreateOptions{})
		require.NoError(t, err, "repository creation should succeed")
		t.Cleanup(func() {
			_ = helper.Repositories.Resource.Delete(context.Background(), repo, metav1.DeleteOptions{})
		})

		require.EventuallyWithT(t, func(c *assert.CollectT) {
			obj, err := helper.Repositories.Resource.Get(t.Context(), repo, metav1.GetOptions{})
			if !assert.NoError(c, err) {
				return
			}
			r := common.MustFromUnstructured[provisioning.Repository](t, obj)
			assert.False(c, r.Status.Health.Healthy, "repository should be unhealthy")
			reachable := common.FindCondition(r.Status.Conditions, provisioning.ConditionTypeReachable)
			if !assert.NotNil(c, reachable, "Reachable condition should exist") {
				return
			}
			assert.Equal(c, metav1.ConditionFalse, reachable.Status)
			assert.Equal(c, provisioning.ReasonAuthenticationFailed, reachable.Reason)
			assert.Equal(c, r.Generation, reachable.ObservedGeneration,
				"controller should have observed the current generation")
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
			"repository with bad credentials should report Reachable=False/AuthenticationFailed")
	})
}

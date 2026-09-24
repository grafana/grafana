package webhook

import (
	"encoding/json"
	"net/http"
	"sync/atomic"
	"testing"

	"github.com/google/go-github/v82/github"
	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_GithubRepoDeletionBlockedByWebhook proves the
// reactive deletion status end to end: when the cleanup finalizer cannot remove
// the provider-side webhook (here the provider returns 403), the repository
// wedges in Terminating and status.deletion reports the blocking finalizer and
// why, so a client can point the user at exactly the finalizer to force-remove.
// Removing that finalizer then lets the deletion complete.
func TestIntegrationProvisioning_GithubRepoDeletionBlockedByWebhook(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "github-webhook-deletion-blocked"
	const hookID = int64(789)
	webhookURL := expectedWebhookURL(webhookBaseURL, helper.Namespace, repoName)

	hook := &github.Hook{
		ID:     new(hookID),
		Active: new(true),
		Events: []string{"pull_request", "push"},
		Config: &github.HookConfig{URL: new(webhookURL)},
	}
	encode := func(v any) http.HandlerFunc {
		return func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(v)
		}
	}

	// The webhook DELETE always fails with 403 (access lost). deleteWebhook only
	// tolerates 404, so this fails the cleanup finalizer rather than orphaning the
	// webhook silently — the condition that wedges deletion.
	var deleteCalls atomic.Int32
	mockOpts := append(githubHealthCheckMocks(),
		ghmock.WithRequestMatchHandler(ghmock.GetReposHooksByOwnerByRepo, encode([]*github.Hook{hook})),
		ghmock.WithRequestMatchHandler(ghmock.PostReposHooksByOwnerByRepo, encode(hook)),
		ghmock.WithRequestMatchHandler(ghmock.GetReposHooksByOwnerByRepoByHookId, encode(hook)),
		ghmock.WithRequestMatchHandler(
			ghmock.DeleteReposHooksByOwnerByRepoByHookId,
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				deleteCalls.Add(1)
				w.WriteHeader(http.StatusForbidden)
				_ = json.NewEncoder(w).Encode(map[string]any{"message": "Resource not accessible by integration"})
			}),
		),
	)
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient(mockOpts...)

	helper.CreateGithubRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("gh-del-blocked-dash", "GitHub Deletion Blocked Dashboard", 1),
	}, webhookBaseURL, "write")
	waitForWebhook(t, helper, repoName, hookID)

	// Delete normally (keep all finalizers). The cleanup finalizer's webhook
	// removal will fail, so deletion cannot complete.
	require.NoError(t, helper.Repositories.Resource.Delete(t.Context(), repoName, metav1.DeleteOptions{}),
		"repository delete request should be accepted")

	// The controller records the structured deletion status naming the cleanup
	// finalizer as the blocker.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
		if !assert.NotNil(collect, repo.Status.Deletion, "deletion status should be populated") {
			return
		}
		assert.Equal(collect, provisioning.DeletionStateBlocked, repo.Status.Deletion.State)
		assert.Equal(collect, repository.CleanFinalizer, repo.Status.Deletion.Finalizer,
			"the cleanup finalizer is the one blocking deletion")
		assert.Contains(collect, repo.Status.Deletion.Message, "delete webhook",
			"the message should explain the webhook removal failure")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "deletion status should surface the blocking finalizer")

	require.Positive(t, deleteCalls.Load(), "the webhook delete must have been attempted")

	// Recovery: force-remove the finalizer status.deletion pointed at. This is the
	// action a client offers the user; dropping it lets the remaining finalizers
	// finish and the repository is deleted. Retry to absorb a concurrent reconcile
	// bumping the resourceVersion between read and write.
	patch := []byte(`{"metadata":{"finalizers":["remove-orphan-resources","remove-pending-jobs"]}}`)
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		_, err := helper.Repositories.Resource.Patch(t.Context(), repoName, types.MergePatchType, patch, metav1.PatchOptions{})
		assert.NoError(collect, err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "force-remove the blocking cleanup finalizer")

	helper.WaitForRepositoryDeleted(t, repoName)
}

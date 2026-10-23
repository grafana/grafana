package webhook

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common/webhooksuite"
)

func TestIntegrationProvisioning_WebhookNotCreatedWhenDisabled(t *testing.T) {
	helper := githubHelper(t)
	const repoName = "webhook-disabled"
	createGithubRepo(t, helper, repoName, webhooksuite.RepoOptions{WebhookDisabled: true})

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		repo, err := common.FromUnstructured[provisioning.Repository](obj)
		if !assert.NoError(collect, err) {
			return
		}
		assert.Equal(collect, repo.Generation, repo.Status.ObservedGeneration, "controller should have processed the repo")
		assert.Nil(collect, repo.Status.Webhook, "no webhook should be created when disabled")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "repo should be reconciled without webhook")
	require.Zero(t, githubMock.State(repoName).HookCreates, "webhook must not be registered with the provider")
}

func TestIntegrationProvisioning_WebhookRemovedWhenDisabled(t *testing.T) {
	helper := githubHelper(t)
	const repoName = "webhook-removed-when-disabled"
	createGithubRepo(t, helper, repoName, webhooksuite.RepoOptions{})
	webhooksuite.WaitForWebhook(t, helper, repoName, githubMock.HookID(repoName))

	webhooksuite.UpdateSpec(t, helper, repoName, func(spec map[string]any) {
		spec["webhook"] = map[string]any{"disabled": true}
	})
	requireWebhookRemoved(t, helper, repoName)
}

func TestIntegrationProvisioning_WebhookRemovedWhenWorkflowsCleared(t *testing.T) {
	helper := githubHelper(t)
	const repoName = "webhook-removed-without-workflows"
	createGithubRepo(t, helper, repoName, webhooksuite.RepoOptions{})
	webhooksuite.WaitForWebhook(t, helper, repoName, githubMock.HookID(repoName))

	webhooksuite.UpdateSpec(t, helper, repoName, func(spec map[string]any) {
		spec["workflows"] = []any{}
	})
	requireWebhookRemoved(t, helper, repoName)
}

func TestIntegrationProvisioning_WebhookFailureDoesNotRetryImmediately(t *testing.T) {
	helper := githubHelper(t)
	const repoName = "webhook-create-failure"
	createGithubRepo(t, helper, repoName, webhooksuite.RepoOptions{HookCreateFails: true})

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err, "failed to get repository") {
			return
		}
		repo, err := common.FromUnstructured[provisioning.Repository](obj)
		if !assert.NoError(collect, err) {
			return
		}
		assert.GreaterOrEqual(collect, githubMock.State(repoName).HookCreates, 1, "webhook creation should have been attempted")
		assert.False(collect, repo.Status.Health.Healthy, "repository should remain unhealthy after hook failure")
		assert.Equal(collect, provisioning.HealthFailureHook, repo.Status.Health.Error, "repository should record hook failure")
		assert.Nil(collect, repo.Status.Webhook, "webhook status should remain unset when creation fails")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "repository should record the initial webhook failure")

	settled := waitForStableCount(t, func() int { return githubMock.State(repoName).HookCreates }, 2*time.Second, common.WaitTimeoutDefault)
	require.Never(t, func() bool {
		return githubMock.State(repoName).HookCreates > settled
	}, 5*time.Second, 100*time.Millisecond, "webhook creation should not be retried while the hook failure cooldown is active")
}

func TestIntegrationProvisioning_WebhookRejectedForUnhealthyRepository(t *testing.T) {
	helper := githubHelper(t)
	const repoName = "webhook-unhealthy-repo"
	createGithubRepo(t, helper, repoName, webhooksuite.RepoOptions{HookCreateFails: true, SyncEnabled: true})
	helper.WaitForUnhealthyRepository(t, repoName)

	header, body := githubPushEvent("git/"+repoName, "refs/heads/main", [][]string{{"dashboard.json"}})
	githubMock.Sign(header, "any-secret", body)
	code, job, err := webhooksuite.TryDeliverSignedWebhook(t, helper, repoName, header, body)
	require.Error(t, err, "a delivery to an unhealthy repository must be rejected")
	require.Equal(t, http.StatusFailedDependency, code)
	require.Nil(t, job)
}

func TestIntegrationProvisioning_WebhookForceDeleteSkipsProvider(t *testing.T) {
	helper := githubHelper(t)
	const repoName = "webhook-force-delete"
	createGithubRepo(t, helper, repoName, webhooksuite.RepoOptions{})
	webhooksuite.WaitForWebhook(t, helper, repoName, githubMock.HookID(repoName))

	webhooksuite.RemoveCleanupFinalizer(t, helper, repoName)
	require.NoError(t, helper.Repositories.Resource.Delete(t.Context(), repoName, metav1.DeleteOptions{}), "repository delete request should be accepted")
	helper.WaitForRepositoryDeleted(t, repoName)

	require.Zero(t, githubMock.State(repoName).HookDeletes, "webhook delete must not be attempted once the cleanup finalizer is removed")
}

func TestIntegrationProvisioning_WebhookIgnoredEvents(t *testing.T) {
	helper := githubHelper(t)
	const repoName = "webhook-ignored-events"
	createGithubRepo(t, helper, repoName, webhooksuite.RepoOptions{SyncEnabled: true})
	webhooksuite.WaitForWebhook(t, helper, repoName, githubMock.HookID(repoName))
	helper.SyncAndWait(t, repoName)

	for _, tt := range []struct {
		name  string
		event func() (http.Header, []byte)
	}{
		{"push to another branch", func() (http.Header, []byte) {
			return githubPushEvent("git/"+repoName, "refs/heads/other", [][]string{{"dashboard.json"}})
		}},
		{"pull request to another branch", func() (http.Header, []byte) {
			return githubPullRequestEvent(repoName, "opened", "other", 130, "feature", "sha-other-base", map[string]any{"id": 1})
		}},
		{"closed pull request", func() (http.Header, []byte) {
			return githubPullRequestEvent(repoName, "closed", "main", 131, "feature", "sha-closed", map[string]any{"id": 1})
		}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			header, body := tt.event()
			code, job := webhooksuite.DeliverWebhook(t, helper, githubMock, repoName, header, body)
			require.Equal(t, http.StatusOK, code)
			require.Nil(t, job, "the event must not queue a job")
		})
	}

	require.Positive(t, webhooksuite.GetRepository(t, helper, repoName).Status.Webhook.LastEvent, "deliveries should record the last event time")
}

func TestIntegrationProvisioning_WebhookPushWithSyncDisabledIgnored(t *testing.T) {
	helper := githubHelper(t)
	const repoName = "webhook-sync-disabled"
	createGithubRepo(t, helper, repoName, webhooksuite.RepoOptions{})
	webhooksuite.WaitForWebhook(t, helper, repoName, githubMock.HookID(repoName))

	header, body := githubPushEvent("git/"+repoName, "refs/heads/main", [][]string{{"dashboard.json"}})
	code, job := webhooksuite.DeliverWebhook(t, helper, githubMock, repoName, header, body)
	require.Equal(t, http.StatusOK, code)
	require.Nil(t, job, "a push must not queue a sync when sync is disabled")
}

func TestIntegrationProvisioning_WebhookRepositoryMismatchRejected(t *testing.T) {
	helper := githubHelper(t)
	const repoName = "webhook-repository-mismatch"
	createGithubRepo(t, helper, repoName, webhooksuite.RepoOptions{SyncEnabled: true})
	webhooksuite.WaitForWebhook(t, helper, repoName, githubMock.HookID(repoName))

	header, body := githubPushEvent("git/another-repository", "refs/heads/main", [][]string{{"dashboard.json"}})
	code, job, err := webhooksuite.TryDeliverWebhook(t, helper, githubMock, repoName, header, body)
	require.Error(t, err, "an event for another repository must be rejected")
	require.Equal(t, http.StatusBadRequest, code)
	require.Nil(t, job)
}

func TestIntegrationProvisioning_WebhookReplayedDeliveryDropped(t *testing.T) {
	helper := githubHelper(t)
	const repoName = "webhook-replayed-delivery"
	createGithubRepo(t, helper, repoName, webhooksuite.RepoOptions{SyncEnabled: true})
	webhooksuite.WaitForWebhook(t, helper, repoName, githubMock.HookID(repoName))
	helper.SyncAndWait(t, repoName)

	header, body, job := pushWhenIdle(t, helper, repoName)
	helper.AwaitJob(t, job)

	code, job := webhooksuite.DeliverWebhook(t, helper, githubMock, repoName, header.Clone(), body)
	require.Equal(t, http.StatusOK, code, "a replayed delivery must be acknowledged")
	require.Nil(t, job, "a replayed delivery must not queue a job")
}

func TestIntegrationProvisioning_PullRequestMissingRefCompletesWithWarning(t *testing.T) {
	helper := githubHelper(t)
	const repoName = "pr-missing-ref"
	const dashboardPath = "dashboard.json"
	local := githubMock.CreateRepo(t, helper, repoName, map[string][]byte{
		dashboardPath: common.DashboardJSON("pr-missing-ref-dash", "PR Missing Ref Dashboard", 1),
	}, webhooksuite.RepoOptions{})
	webhooksuite.WaitForWebhook(t, helper, repoName, githubMock.HookID(repoName))

	const branchName = "feature-pr-missing-ref"
	sha := webhooksuite.CommitDashboardOnBranch(t, local, branchName, dashboardPath, common.DashboardJSON("pr-missing-ref-dash", "PR Missing Ref Dashboard Updated", 2))
	_, err := local.Git("push", "-u", "origin", branchName)
	require.NoError(t, err, "failed to push feature branch")
	_, err = local.Git("push", "origin", "--delete", branchName)
	require.NoError(t, err, "failed to delete feature branch")

	header, body := githubMock.Event(repoName, webhooksuite.Event{Kind: webhooksuite.PullRequestEvent, Number: 126, Branch: branchName, SHA: sha})
	completed := helper.AwaitJob(t, webhooksuite.PostWebhook(t, helper, githubMock, repoName, header, body))

	require.Equal(t, string(provisioning.JobStateWarning), common.MustNestedString(completed.Object, "status", "state"))
	require.Equal(t, fmt.Sprintf("pull request ref %q no longer exists; preview skipped", branchName), common.MustNestedString(completed.Object, "status", "message"))
	require.Empty(t, common.MustNestedStringSlice(completed.Object, "status", "errors"))
	require.Empty(t, githubMock.State(repoName).Comments, "missing-ref preview should not post a pull request comment")
}

package webhooksuite

import (
	"fmt"
	"net/http"
	"net/url"
	"os/exec"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func Run(t *testing.T, newHelper func(t *testing.T) *common.GitTestHelper, p Provider) {
	cases := []struct {
		name string
		run  func(t *testing.T, helper *common.GitTestHelper, p Provider)
	}{
		{"WebhookCreated", testWebhookCreated},
		{"PushWebhookTriggersSync", testPushWebhookTriggersSync},
		{"InvalidSignatureRejected", testInvalidSignatureRejected},
		{"UnsupportedEventNotImplemented", testUnsupportedEventNotImplemented},
		{"PushOverIncrementalLimitUsesFullSync", testPushOverIncrementalLimitUsesFullSync},
		{"PullRequestWebhookPostsComment", testPullRequestWebhookPostsComment},
		{"PullRequestWebhookEditsPreviewComment", testPullRequestWebhookEditsPreviewComment},
		{"PullRequestFromForkSkipsPreview", testPullRequestFromForkSkipsPreview},
		{"DeletionBlockedByWebhook", testDeletionBlockedByWebhook},
		{"WebhookRecreatedWhenStatusCleared", testWebhookRecreatedWhenStatusCleared},
		{"WebhookRecreatedWhenDeletedInProvider", testWebhookRecreatedWhenDeletedInProvider},
		{"WebhookSecretRotatedWhenExpired", testWebhookSecretRotatedWhenExpired},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			c.run(t, newHelper(t), p)
		})
	}
}

func testWebhookCreated(t *testing.T, helper *common.GitTestHelper, p Provider) {
	repoName := p.Name() + "-webhook-created"
	p.CreateRepo(t, helper, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("created-dash", "Created Dashboard", 1),
	}, RepoOptions{})

	WaitForWebhook(t, helper, repoName, p.HookID(repoName))
	require.Equal(t, 1, p.State(repoName).HookCreates, "webhook should be registered once")
}

func testPushWebhookTriggersSync(t *testing.T, helper *common.GitTestHelper, p Provider) {
	repoName := p.Name() + "-push-sync"
	local := p.CreateRepo(t, helper, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("push-dash", "Push Dashboard", 1),
	}, RepoOptions{SyncEnabled: true})
	WaitForWebhook(t, helper, repoName, p.HookID(repoName))
	helper.SyncAndWait(t, repoName)

	pushedPath := "pushed.json"
	require.NoError(t, local.CreateFile(pushedPath, string(common.DashboardJSON("pushed-dash", "Pushed Dashboard", 1))))
	_, err := local.Git("add", pushedPath)
	require.NoError(t, err, "failed to add dashboard")
	_, err = local.Git("commit", "-m", "Add dashboard")
	require.NoError(t, err, "failed to commit dashboard")
	_, err = local.Git("push")
	require.NoError(t, err, "failed to push dashboard")

	header, body := p.Event(repoName, Event{Kind: PushEvent, Commits: [][]string{{pushedPath}}})
	job := PostWebhook(t, helper, p, repoName, header, body)
	require.Equal(t, string(provisioning.JobActionPull), common.MustNestedString(job.Object, "spec", "action"))

	finished := helper.AwaitJob(t, job)
	require.Equal(t, string(provisioning.JobStateSuccess), common.MustNestedString(finished.Object, "status", "state"))
	common.RequireRepoManagedDashboard(t, helper.DashboardsV1, "pushed-dash", repoName, pushedPath)
}

func testInvalidSignatureRejected(t *testing.T, helper *common.GitTestHelper, p Provider) {
	repoName := p.Name() + "-invalid-signature"
	p.CreateRepo(t, helper, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("invalid-signature-dash", "Invalid Signature Dashboard", 1),
	}, RepoOptions{SyncEnabled: true})
	WaitForWebhook(t, helper, repoName, p.HookID(repoName))

	header, body := p.Event(repoName, Event{Kind: PushEvent, Commits: [][]string{{"dashboard.json"}}})
	p.Sign(header, "not-the-webhook-secret", body)
	code, job, err := TryDeliverSignedWebhook(t, helper, repoName, header, body)
	require.Error(t, err, "a delivery signed with the wrong secret must be rejected")
	require.Equal(t, http.StatusUnauthorized, code)
	require.Nil(t, job)
}

func testUnsupportedEventNotImplemented(t *testing.T, helper *common.GitTestHelper, p Provider) {
	repoName := p.Name() + "-unsupported-event"
	p.CreateRepo(t, helper, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("unsupported-event-dash", "Unsupported Event Dashboard", 1),
	}, RepoOptions{SyncEnabled: true})
	WaitForWebhook(t, helper, repoName, p.HookID(repoName))

	header, body := p.Event(repoName, Event{Kind: UnsupportedEvent})
	code, job, _ := TryDeliverWebhook(t, helper, p, repoName, header, body)
	require.Equal(t, http.StatusNotImplemented, code, "an event type that Grafana does not handle must not queue a job")
	require.Nil(t, job)
}

func testPushOverIncrementalLimitUsesFullSync(t *testing.T, helper *common.GitTestHelper, p Provider) {
	repoName := p.Name() + "-push-over-limit"
	local := p.CreateRepo(t, helper, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("limit-dash", "Limit Dashboard", 1),
	}, RepoOptions{SyncEnabled: true})
	WaitForWebhook(t, helper, repoName, p.HookID(repoName))
	helper.SyncAndWait(t, repoName)

	commits := make([][]string, 0, MaxIncrementalChanges+5)
	for i := range MaxIncrementalChanges + 5 {
		path := fmt.Sprintf("limit-%d.json", i)
		require.NoError(t, local.CreateFile(path, string(common.DashboardJSON(fmt.Sprintf("limit-%d", i), fmt.Sprintf("Limit %d", i), 1))))
		_, err := local.Git("add", path)
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "Add "+path)
		require.NoError(t, err)
		commits = append(commits, []string{path})
	}
	_, err := local.Git("push")
	require.NoError(t, err, "failed to push commits")

	header, body := p.Event(repoName, Event{Kind: PushEvent, Commits: commits})
	job := PostWebhook(t, helper, p, repoName, header, body)
	incremental, _, err := unstructured.NestedBool(job.Object, "spec", "pull", "incremental")
	require.NoError(t, err)
	require.False(t, incremental, "a push with %d changes exceeds max_incremental_changes=%d and must use a full sync", len(commits), MaxIncrementalChanges)

	finished := helper.AwaitJob(t, job)
	require.Equal(t, string(provisioning.JobStateSuccess), common.MustNestedString(finished.Object, "status", "state"))
	last := len(commits) - 1
	common.RequireRepoManagedDashboard(t, helper.DashboardsV1, fmt.Sprintf("limit-%d", last), repoName, commits[last][0])
}

func testPullRequestWebhookPostsComment(t *testing.T, helper *common.GitTestHelper, p Provider) {
	repoName := p.Name() + "-pr-comment"
	dashboardPath := "dashboard.json"
	local := p.CreateRepo(t, helper, repoName, map[string][]byte{
		dashboardPath: common.DashboardJSON("pr-comment-dash", "PR Comment Dashboard", 1),
	}, RepoOptions{})
	WaitForWebhook(t, helper, repoName, p.HookID(repoName))
	helper.SyncAndWait(t, repoName)
	common.RequireRepoManagedDashboard(t, helper.DashboardsV1, "pr-comment-dash", repoName, dashboardPath)

	branchName := "feature-pr-comment"
	_, err := local.Git("checkout", "-b", branchName)
	require.NoError(t, err, "failed to create feature branch")
	require.NoError(t, local.UpdateFile(dashboardPath, string(common.DashboardJSON("pr-comment-dash", "PR Comment Dashboard Updated", 2))))
	_, err = local.Git("add", dashboardPath)
	require.NoError(t, err, "failed to add dashboard")
	_, err = local.Git("commit", "-m", "Update dashboard")
	require.NoError(t, err, "failed to commit dashboard update")
	headSHA, err := local.Git("rev-parse", "HEAD")
	require.NoError(t, err, "failed to resolve feature branch SHA")
	_, err = local.Git("push", "-u", "origin", branchName)
	require.NoError(t, err, "failed to push feature branch")

	header, body := p.Event(repoName, Event{Kind: PullRequestEvent, Number: 123, Branch: branchName, SHA: strings.TrimSpace(headSHA)})
	job := PostWebhook(t, helper, p, repoName, header, body)
	require.Equal(t, string(provisioning.JobActionPullRequest), common.MustNestedString(job.Object, "spec", "action"))

	finished := helper.AwaitJob(t, job)
	require.Equal(t, string(provisioning.JobStateSuccess), common.MustNestedString(finished.Object, "status", "state"))
	require.Empty(t, common.MustNestedStringSlice(finished.Object, "status", "errors"))

	isFork, found, err := unstructured.NestedBool(job.Object, "spec", "pr", "isFork")
	require.NoError(t, err)
	require.True(t, found, "the job should record whether the pull request comes from a fork")
	require.False(t, isFork)
	require.Equal(t, 1, p.State(repoName).MergeBaseCalls, "the preview should resolve the merge base once")

	comments := p.State(repoName).Comments
	require.Len(t, comments, 1, "expected one pull request comment")
	comment := comments[0]
	require.Contains(t, comment, "Grafana detected dashboard changes in this pull request")
	require.Contains(t, comment, dashboardPath)
	require.Contains(t, comment, "PR Comment Dashboard Updated")

	originalURL := commentLink(t, comment, "[view current](")
	require.Equal(t, "/d/pr-comment-dash/pr-comment-dashboard-updated", originalURL.Path)

	prURL := common.MustNestedString(job.Object, "spec", "pr", "url")
	require.NotEmpty(t, prURL)
	previewURL := commentLink(t, comment, "[preview changes](")
	require.Equal(t, fmt.Sprintf("/admin/provisioning/%s/dashboard/preview/%s", repoName, dashboardPath), previewURL.Path)
	require.Equal(t, branchName, previewURL.Query().Get("ref"))
	require.Equal(t, url.QueryEscape(prURL), previewURL.Query().Get("pull_request_url"))
	require.Contains(t, previewURL.RawQuery, "pull_request_url="+url.QueryEscape(url.QueryEscape(prURL)))
}

func testPullRequestFromForkSkipsPreview(t *testing.T, helper *common.GitTestHelper, p Provider) {
	repoName := p.Name() + "-pr-fork"
	dashboardPath := "dashboard.json"
	local := p.CreateRepo(t, helper, repoName, map[string][]byte{
		dashboardPath: common.DashboardJSON("pr-fork-dash", "PR Fork Dashboard", 1),
	}, RepoOptions{})
	WaitForWebhook(t, helper, repoName, p.HookID(repoName))
	helper.SyncAndWait(t, repoName)

	branchName := "feature-pr-fork"
	sha := CommitDashboardOnBranch(t, local, branchName, dashboardPath, common.DashboardJSON("pr-fork-dash", "PR Fork Dashboard Updated", 2))
	_, err := local.Git("ls-remote", "--exit-code", "origin", "refs/heads/"+branchName)
	var exitErr *exec.ExitError
	require.ErrorAs(t, err, &exitErr)
	require.Equal(t, 2, exitErr.ExitCode(), "the fork branch must be absent from the configured remote")

	forkURL := "https://git.example.com/contributor/" + repoName
	header, body := p.Event(repoName, Event{Kind: PullRequestEvent, Number: 125, Branch: branchName, SHA: sha, ForkURL: forkURL})
	job := PostWebhook(t, helper, p, repoName, header, body)
	isFork, found, err := unstructured.NestedBool(job.Object, "spec", "pr", "isFork")
	require.NoError(t, err)
	require.True(t, found)
	require.True(t, isFork)
	require.Equal(t, forkURL, common.MustNestedString(job.Object, "spec", "pr", "forkURL"))

	finished := helper.AwaitJob(t, job)
	require.Equal(t, string(provisioning.JobStateSuccess), common.MustNestedString(finished.Object, "status", "state"))
	require.Empty(t, common.MustNestedStringSlice(finished.Object, "status", "errors"))

	message := "Grafana doesn't currently support previews for pull requests from forks."
	require.Equal(t, message, common.MustNestedString(finished.Object, "status", "message"))
	require.Zero(t, p.State(repoName).MergeBaseCalls, "fork pull requests must be skipped before resolving refs")

	comments := p.State(repoName).Comments
	require.Len(t, comments, 1, "expected one pull request comment")
	comment := comments[0]
	require.Contains(t, comment, "\u2139\ufe0f **Pull request preview skipped**\n\n"+message)
	require.Contains(t, comment, "\n\n---\n_\U0001f504 Synced from [**"+GetRepository(t, helper, repoName).Spec.Title+"**](")
	require.Contains(t, comment, "/admin/provisioning/"+repoName)
	require.Contains(t, comment, " \u00b7 Posted by [")
	require.NotContains(t, comment, "preview changes")
	require.NotContains(t, comment, "image rendering setup")
}

func testDeletionBlockedByWebhook(t *testing.T, helper *common.GitTestHelper, p Provider) {
	for _, tc := range []struct {
		name       string
		statusCode int
		cause      provisioning.DeletionCause
	}{
		{name: "user", statusCode: http.StatusForbidden, cause: provisioning.DeletionCauseUser},
		{name: "system", statusCode: http.StatusServiceUnavailable, cause: provisioning.DeletionCauseSystem},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repoName := p.Name() + "-webhook-deletion-blocked-" + tc.name
			p.CreateRepo(t, helper, repoName, map[string][]byte{
				"dashboard.json": common.DashboardJSON("deletion-blocked-dash", "Deletion Blocked Dashboard", 1),
			}, RepoOptions{HookDeleteStatus: tc.statusCode})
			WaitForWebhook(t, helper, repoName, p.HookID(repoName))

			require.NoError(t, helper.Repositories.Resource.Delete(t.Context(), repoName, metav1.DeleteOptions{}),
				"repository delete request should be accepted")

			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
				if !assert.NoError(collect, err) {
					return
				}
				repo, err := common.FromUnstructured[provisioning.Repository](obj)
				if !assert.NoError(collect, err) {
					return
				}
				if !assert.NotNil(collect, repo.Status.Deletion, "deletion status should be populated") {
					return
				}
				assert.Equal(collect, provisioning.DeletionStateBlocked, repo.Status.Deletion.State)
				assert.Equal(collect, tc.cause, repo.Status.Deletion.Cause)
				assert.Equal(collect, repository.CleanFinalizer, repo.Status.Deletion.Finalizer, "the cleanup finalizer is the one blocking deletion")
				assert.Contains(collect, repo.Status.Deletion.Message, "delete webhook", "the message should explain the webhook removal failure")
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "deletion status should surface the blocking finalizer")
			require.Positive(t, p.State(repoName).HookDeletes, "the webhook delete must have been attempted")

			RemoveCleanupFinalizer(t, helper, repoName)
			helper.WaitForRepositoryDeleted(t, repoName)
		})
	}
}

func testPullRequestWebhookEditsPreviewComment(t *testing.T, helper *common.GitTestHelper, p Provider) {
	repoName := p.Name() + "-pr-edit-comment"
	const dashboardPath = "dashboard.json"
	local := p.CreateRepo(t, helper, repoName, map[string][]byte{
		dashboardPath: common.DashboardJSON("pr-edit-dash", "PR Edit Dashboard", 1),
	}, RepoOptions{})
	WaitForWebhook(t, helper, repoName, p.HookID(repoName))
	helper.SyncAndWait(t, repoName)
	common.RequireRepoManagedDashboard(t, helper.DashboardsV1, "pr-edit-dash", repoName, dashboardPath)

	const branchName = "feature-pr-edit-comment"
	_, err := local.Git("checkout", "-b", branchName)
	require.NoError(t, err, "failed to create feature branch")
	for version, title := range []string{"PR Edit Dashboard First", "PR Edit Dashboard Second"} {
		require.NoError(t, local.UpdateFile(dashboardPath, string(common.DashboardJSON("pr-edit-dash", title, version+2))))
		_, err = local.Git("commit", "-am", title)
		require.NoError(t, err, "failed to commit dashboard update")
		headSHA, err := local.Git("rev-parse", "HEAD")
		require.NoError(t, err, "failed to resolve feature branch SHA")
		_, err = local.Git("push", "-u", "origin", branchName)
		require.NoError(t, err, "failed to push feature branch")

		header, body := p.Event(repoName, Event{Kind: PullRequestEvent, Number: 124, Branch: branchName, SHA: strings.TrimSpace(headSHA)})
		finished := helper.AwaitJob(t, PostWebhook(t, helper, p, repoName, header, body))
		require.Equal(t, string(provisioning.JobStateSuccess), common.MustNestedString(finished.Object, "status", "state"))
	}

	comments := p.State(repoName).Comments
	require.Len(t, comments, 1, "the second preview must edit the first comment instead of posting a new one")
	require.Contains(t, comments[0], "PR Edit Dashboard Second")
	require.NotContains(t, comments[0], "PR Edit Dashboard First")
}

func testWebhookRecreatedWhenStatusCleared(t *testing.T, helper *common.GitTestHelper, p Provider) {
	repoName := p.Name() + "-webhook-recreated"
	p.CreateRepo(t, helper, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("recreated-dash", "Recreated Dashboard", 1),
	}, RepoOptions{})
	WaitForWebhook(t, helper, repoName, p.HookID(repoName))

	patch := []byte(`{"status":{"webhook":null}}`)
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		_, err := helper.Repositories.Resource.Patch(t.Context(), repoName, types.MergePatchType, patch, metav1.PatchOptions{}, "status")
		assert.NoError(collect, err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "clear webhook status")
	UpdateSpec(t, helper, repoName, func(spec map[string]any) { spec["title"] = repoName + " (updated)" })

	WaitForWebhook(t, helper, repoName, p.HookID(repoName))
	require.Eventually(t, func() bool {
		return p.State(repoName).HookCreates == 2
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "webhook should be registered again")
	requireProviderSecret(t, helper, p, repoName)
}

func testWebhookRecreatedWhenDeletedInProvider(t *testing.T, helper *common.GitTestHelper, p Provider) {
	repoName := p.Name() + "-webhook-deleted-in-provider"
	p.CreateRepo(t, helper, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("deleted-hook-dash", "Deleted Hook Dashboard", 1),
	}, RepoOptions{})
	WaitForWebhook(t, helper, repoName, p.HookID(repoName))

	p.RemoveHook(repoName)
	UpdateSpec(t, helper, repoName, func(spec map[string]any) { spec["title"] = repoName + " (updated)" })

	require.Eventually(t, func() bool {
		return p.State(repoName).HookCreates == 2
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "a webhook deleted in the provider should be registered again")
	WaitForWebhook(t, helper, repoName, p.HookID(repoName))
	requireProviderSecret(t, helper, p, repoName)
}

func testWebhookSecretRotatedWhenExpired(t *testing.T, helper *common.GitTestHelper, p Provider) {
	repoName := p.Name() + "-webhook-rotation"
	p.CreateRepo(t, helper, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("rotation-dash", "Rotation Dashboard", 1),
	}, RepoOptions{})
	WaitForWebhook(t, helper, repoName, p.HookID(repoName))

	status := GetRepository(t, helper, repoName).Status.Webhook
	require.Positive(t, status.LastRotated, "LastRotated should be set on creation")
	previousSecret := requireProviderSecret(t, helper, p, repoName)

	expiredTimestamp := int64(1)
	status.LastRotated = expiredTimestamp
	patch := common.AsJSON(map[string]any{"status": map[string]any{"webhook": status}})
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		_, err := helper.Repositories.Resource.Patch(t.Context(), repoName, types.MergePatchType, patch, metav1.PatchOptions{}, "status")
		assert.NoError(collect, err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "expire LastRotated")
	UpdateSpec(t, helper, repoName, func(spec map[string]any) { spec["title"] = repoName + " (updated)" })

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		repo, err := common.FromUnstructured[provisioning.Repository](obj)
		if !assert.NoError(collect, err) {
			return
		}
		if assert.NotNil(collect, repo.Status.Webhook) {
			assert.Greater(collect, repo.Status.Webhook.LastRotated, expiredTimestamp, "LastRotated should be updated after rotation")
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "webhook secret should be rotated when expired")
	require.NotEqual(t, previousSecret, requireProviderSecret(t, helper, p, repoName), "webhook secret should change on rotation")
	require.Equal(t, 1, p.State(repoName).HookCreates, "rotation should edit the existing webhook")
}

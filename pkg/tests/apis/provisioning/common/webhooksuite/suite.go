package webhooksuite

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/grafana/nanogit/gittest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

type Provider interface {
	Name() string
	CreateRepo(t *testing.T, helper *common.GitTestHelper, repoName string, files map[string][]byte, opts RepoOptions) *gittest.LocalRepo
	HookID(repoName string) repository.WebhookID
	HookCreates(repoName string) int
	Comments(repoName string) []string
	PushEvent(repoName string, commits [][]string) (http.Header, []byte)
	PullRequestEvent(repoName string, number int, branch, sha string) (http.Header, []byte)
	Sign(header http.Header, secret string, body []byte)
}

func Run(t *testing.T, newHelper func(t *testing.T) *common.GitTestHelper, p Provider) {
	cases := []struct {
		name string
		run  func(t *testing.T, helper *common.GitTestHelper, p Provider)
	}{
		{"NoWebhookWhenDisabled", testNoWebhookWhenDisabled},
		{"WebhookCreated", testWebhookCreated},
		{"PushWebhookTriggersSync", testPushWebhookTriggersSync},
		{"PushOverIncrementalLimitUsesFullSync", testPushOverIncrementalLimitUsesFullSync},
		{"PullRequestWebhookPostsComment", testPullRequestWebhookPostsComment},
		{"WebhookRecreatedWhenMissing", testWebhookRecreatedWhenMissing},
		{"WebhookSecretRotatedWhenExpired", testWebhookSecretRotatedWhenExpired},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			c.run(t, newHelper(t), p)
		})
	}
}

func testNoWebhookWhenDisabled(t *testing.T, helper *common.GitTestHelper, p Provider) {
	repoName := p.Name() + "-webhook-disabled"
	p.CreateRepo(t, helper, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("disabled-dash", "Disabled Dashboard", 1),
	}, RepoOptions{WebhookDisabled: true})

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
		assert.Equal(collect, repo.Generation, repo.Status.ObservedGeneration, "controller should have processed the repo")
		assert.Nil(collect, repo.Status.Webhook, "no webhook should be created when disabled")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "repo should be reconciled without webhook")
	require.Zero(t, p.HookCreates(repoName), "webhook must not be registered with the provider")
}

func testWebhookCreated(t *testing.T, helper *common.GitTestHelper, p Provider) {
	repoName := p.Name() + "-webhook-created"
	p.CreateRepo(t, helper, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("created-dash", "Created Dashboard", 1),
	}, RepoOptions{})

	WaitForWebhook(t, helper, repoName, p.HookID(repoName))
	require.Equal(t, 1, p.HookCreates(repoName), "webhook should be registered once")
}

func testPushWebhookTriggersSync(t *testing.T, helper *common.GitTestHelper, p Provider) {
	repoName := p.Name() + "-push-sync"
	local := p.CreateRepo(t, helper, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("push-dash", "Push Dashboard", 1),
	}, RepoOptions{SyncEnabled: true})
	WaitForWebhook(t, helper, repoName, p.HookID(repoName))
	helper.SyncAndWait(t, repoName)

	const pushedPath = "pushed.json"
	require.NoError(t, local.CreateFile(pushedPath, string(common.DashboardJSON("pushed-dash", "Pushed Dashboard", 1))))
	_, err := local.Git("add", pushedPath)
	require.NoError(t, err, "failed to add dashboard")
	_, err = local.Git("commit", "-m", "Add dashboard")
	require.NoError(t, err, "failed to commit dashboard")
	_, err = local.Git("push")
	require.NoError(t, err, "failed to push dashboard")

	header, body := p.PushEvent(repoName, [][]string{{pushedPath}})
	job := PostWebhook(t, helper, p, repoName, header, body)
	require.Equal(t, string(provisioning.JobActionPull), common.MustNestedString(job.Object, "spec", "action"))

	finished := helper.AwaitJob(t, job)
	require.Equal(t, string(provisioning.JobStateSuccess), common.MustNestedString(finished.Object, "status", "state"))
	common.RequireRepoManagedDashboard(t, helper.DashboardsV1, "pushed-dash", repoName, pushedPath)
}

func testPushOverIncrementalLimitUsesFullSync(t *testing.T, helper *common.GitTestHelper, p Provider) {
	repoName := p.Name() + "-push-over-limit"
	local := p.CreateRepo(t, helper, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("limit-dash", "Limit Dashboard", 1),
	}, RepoOptions{SyncEnabled: true})
	WaitForWebhook(t, helper, repoName, p.HookID(repoName))
	helper.SyncAndWait(t, repoName)

	var commits [][]string
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

	header, body := p.PushEvent(repoName, commits)
	job := PostWebhook(t, helper, p, repoName, header, body)
	incremental, _, err := unstructured.NestedBool(job.Object, "spec", "pull", "incremental")
	require.NoError(t, err)
	require.False(t, incremental, "a push with %d changes exceeds max_incremental_changes=%d and must use a full sync", len(commits), MaxIncrementalChanges)
	helper.AwaitJob(t, job)
}

func testPullRequestWebhookPostsComment(t *testing.T, helper *common.GitTestHelper, p Provider) {
	repoName := p.Name() + "-pr-comment"
	const dashboardPath = "dashboard.json"
	local := p.CreateRepo(t, helper, repoName, map[string][]byte{
		dashboardPath: common.DashboardJSON("pr-comment-dash", "PR Comment Dashboard", 1),
	}, RepoOptions{})
	WaitForWebhook(t, helper, repoName, p.HookID(repoName))
	helper.SyncAndWait(t, repoName)
	common.RequireRepoManagedDashboard(t, helper.DashboardsV1, "pr-comment-dash", repoName, dashboardPath)

	const branchName = "feature-pr-comment"
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

	header, body := p.PullRequestEvent(repoName, 123, branchName, strings.TrimSpace(headSHA))
	job := PostWebhook(t, helper, p, repoName, header, body)
	require.Equal(t, string(provisioning.JobActionPullRequest), common.MustNestedString(job.Object, "spec", "action"))

	finished := helper.AwaitJob(t, job)
	require.Equal(t, string(provisioning.JobStateSuccess), common.MustNestedString(finished.Object, "status", "state"))
	require.Empty(t, common.MustNestedStringSlice(finished.Object, "status", "errors"))

	comments := p.Comments(repoName)
	require.Len(t, comments, 1, "expected one pull request comment")
	require.Contains(t, comments[0], "Grafana detected dashboard changes in this pull request")
	require.Contains(t, comments[0], dashboardPath)
	require.Contains(t, comments[0], "PR Comment Dashboard Updated")
	require.Contains(t, comments[0], fmt.Sprintf("/admin/provisioning/%s/dashboard/preview/%s", repoName, dashboardPath))
}

func testWebhookRecreatedWhenMissing(t *testing.T, helper *common.GitTestHelper, p Provider) {
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
	updateTitle(t, helper, repoName)

	WaitForWebhook(t, helper, repoName, p.HookID(repoName))
	require.Eventually(t, func() bool {
		return p.HookCreates(repoName) == 2
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "webhook should be registered again")
}

func testWebhookSecretRotatedWhenExpired(t *testing.T, helper *common.GitTestHelper, p Provider) {
	repoName := p.Name() + "-webhook-rotation"
	p.CreateRepo(t, helper, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("rotation-dash", "Rotation Dashboard", 1),
	}, RepoOptions{})
	WaitForWebhook(t, helper, repoName, p.HookID(repoName))

	status := getRepository(t, helper, repoName).Status.Webhook
	require.Positive(t, status.LastRotated, "LastRotated should be set on creation")
	previousSecret := webhookSecret(t, helper, repoName)

	const expiredTimestamp = int64(1)
	status.LastRotated = expiredTimestamp
	patch := MustJSON(map[string]any{"status": map[string]any{"webhook": status}})
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		_, err := helper.Repositories.Resource.Patch(t.Context(), repoName, types.MergePatchType, patch, metav1.PatchOptions{}, "status")
		assert.NoError(collect, err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "expire LastRotated")
	updateTitle(t, helper, repoName)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
		if assert.NotNil(collect, repo.Status.Webhook) {
			assert.Greater(collect, repo.Status.Webhook.LastRotated, expiredTimestamp, "LastRotated should be updated after rotation")
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "webhook secret should be rotated when expired")
	require.NotEqual(t, previousSecret, webhookSecret(t, helper, repoName), "webhook secret should change on rotation")
	require.Equal(t, 1, p.HookCreates(repoName), "rotation should edit the existing webhook")
}

func updateTitle(t *testing.T, helper *common.GitTestHelper, repoName string) {
	t.Helper()
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		latest, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		updated := latest.DeepCopy()
		updated.Object["spec"].(map[string]any)["title"] = repoName + " (updated)"
		_, err = helper.Repositories.Resource.Update(t.Context(), updated, metav1.UpdateOptions{})
		assert.NoError(collect, err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "spec update should succeed")
}

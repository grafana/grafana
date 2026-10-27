package webhook

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common/webhooksuite"
)

func createGithubRepo(t *testing.T, helper *common.GitTestHelper, repoName string, opts webhooksuite.RepoOptions) {
	t.Helper()
	githubMock.CreateRepo(t, helper, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON(repoName+"-dash", repoName, 1),
	}, opts)
}

func requireWebhookRemoved(t *testing.T, helper *common.GitTestHelper, repoName string) {
	t.Helper()
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		repo, err := common.FromUnstructured[provisioning.Repository](obj)
		if !assert.NoError(collect, err) {
			return
		}
		assert.Nil(collect, repo.Status.Webhook, "webhook status should be cleared")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "webhook should be removed")
	require.Equal(t, 1, githubMock.State(repoName).HookDeletes, "the webhook should be deleted from the provider")
}

func waitForStableCount(t *testing.T, count func() int, stableFor, timeout time.Duration) int {
	t.Helper()

	pollInterval := 50 * time.Millisecond
	deadline := time.Now().Add(timeout)
	last := count()
	stableSince := time.Now()

	for time.Now().Before(deadline) {
		time.Sleep(pollInterval)
		switch current := count(); {
		case current != last:
			last, stableSince = current, time.Now()
		case time.Since(stableSince) >= stableFor:
			return current
		}
	}

	t.Fatalf("webhook creation attempts never stopped: still climbing after %s (last count %d)", timeout, last)
	return 0
}

func pushWhenIdle(t *testing.T, helper *common.GitTestHelper, repoName string) (http.Header, []byte, *unstructured.Unstructured) {
	t.Helper()
	header, body := githubPushEvent("git/"+repoName, "refs/heads/main", [][]string{{"dashboard.json"}})
	var job *unstructured.Unstructured
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		body = append(body, ' ')
		code, delivered, err := webhooksuite.TryDeliverWebhook(t, helper, githubMock, repoName, header, body)
		if apierrors.IsAlreadyExists(err) {
			collect.Errorf("a sync job is still active: %v", err)
			return
		}
		require.NoError(collect, err)
		require.Equal(collect, http.StatusAccepted, code, "webhook should queue a job")
		job = delivered
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "webhook should queue a job")
	return header, body, job
}

var env = common.NewSharedGitEnv(append(webhooksuite.EnvOptions(),
	common.WithRepositoryTypes([]string{"git", "github"}),
)...)

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

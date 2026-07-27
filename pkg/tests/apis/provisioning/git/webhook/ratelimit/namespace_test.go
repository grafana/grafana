package ratelimit

import (
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_WebhookRateLimitNamespaceIsolation verifies the
// limiter keys on the request namespace (tenant), so a flood against one
// namespace does not throttle another's deliveries — the noisy-neighbour
// guarantee. Both requests originate from the same client IP, so the namespace
// is the only thing separating their buckets.
func TestIntegrationProvisioning_WebhookRateLimitNamespaceIsolation(t *testing.T) {
	helper := sharedGitHelper(t)

	// Two organizations => two namespaces. orgB's webhook is never flooded, so
	// its bucket stays independent of orgA's.
	orgA := helper.WithNamespace(t, helper.Namespacer(helper.Org1.OrgID), helper.Org1.Admin)
	orgB := helper.WithNamespace(t, helper.Namespacer(helper.OrgB.OrgID), helper.OrgB.Admin)
	defer orgA.Cleanup(t)
	defer orgB.Cleanup(t)

	const repoA = "webhook-rl-orga"
	const repoB = "webhook-rl-orgb"
	// A plain local repo is enough: the limiter wraps the handler for every
	// repository type and runs before any repository-specific work.
	orgA.CreateLocalRepo(t, common.TestRepo{
		Name:       repoA,
		SyncTarget: "folder",
		LocalPath:  filepath.Join(helper.ProvisioningPath, repoA),
		SkipSync:   true,
	})
	orgB.CreateLocalRepo(t, common.TestRepo{
		Name:       repoB,
		SyncTarget: "folder",
		LocalPath:  filepath.Join(helper.ProvisioningPath, repoB),
		SkipSync:   true,
	})

	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
	webhookURL := func(namespace, repo string) string {
		return fmt.Sprintf(
			"http://%s/apis/provisioning.grafana.app/v0alpha1/namespaces/%s/repositories/%s/webhook",
			addr, namespace, repo)
	}

	// Each org uses its own admin credentials so the request is authorized for
	// its namespace and reaches the handler (rather than being rejected earlier
	// for the wrong reason). The QPS limiter and 429 auto-retry live on the k8s
	// REST client, so we drive a plain HTTP client built from the same config.
	clientA, err := rest.HTTPClientFor(helper.Org1.Admin.NewRestConfig())
	require.NoError(t, err)
	clientB, err := rest.HTTPClientFor(helper.OrgB.Admin.NewRestConfig())
	require.NoError(t, err)

	post := func(t *testing.T, client *http.Client, url string) int {
		t.Helper()
		req, err := http.NewRequestWithContext(t.Context(), http.MethodPost, url, http.NoBody)
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		resp, err := client.Do(req)
		require.NoError(t, err)
		_, _ = io.Copy(io.Discard, resp.Body)
		require.NoError(t, resp.Body.Close())
		return resp.StatusCode
	}

	// Baseline: an admitted request reaches the handler. A local repo can't take
	// webhooks, so the handler answers with a 4xx that is NOT 429 — this is the
	// "passed the limiter" marker we compare orgB against.
	baseline := post(t, clientA, webhookURL(orgA.Namespace, repoA))
	require.NotEqual(t, http.StatusTooManyRequests, baseline,
		"a fresh request must pass the limiter")

	// Saturate orgA's bucket.
	const attempts = 100
	throttledA := 0
	for i := 0; i < attempts; i++ {
		if post(t, clientA, webhookURL(orgA.Namespace, repoA)) == http.StatusTooManyRequests {
			throttledA++
		}
	}
	require.Positive(t, throttledA, "orgA should be throttled after flooding its namespace")

	// orgB, keyed on a different namespace, must be unaffected while orgA is
	// throttled: every probe reaches the handler (same baseline code), none are
	// 429. A handful stays well under orgB's burst.
	for i := 0; i < 3; i++ {
		codeB := post(t, clientB, webhookURL(orgB.Namespace, repoB))
		assert.NotEqualf(t, http.StatusTooManyRequests, codeB,
			"orgB must not be throttled by orgA's flood (probe %d)", i)
		assert.Equalf(t, baseline, codeB,
			"orgB request should reach the handler like a normal delivery (probe %d)", i)
	}
}

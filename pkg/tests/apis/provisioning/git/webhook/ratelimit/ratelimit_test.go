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

// TestIntegrationProvisioning_WebhookRateLimited verifies the webhook subresource
// handler is wrapped by the per-client rate limiter: once a single client
// exceeds the configured burst, further deliveries are rejected with 429 before
// the handler does any work.
func TestIntegrationProvisioning_WebhookRateLimited(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "webhook-ratelimit"
	// A plain git repo is enough: the limiter wraps the webhook handler for every
	// repository type, and it runs before signature validation, so we need
	// neither a GitHub repo nor a valid signature to reach it.
	helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("rl-dash", "Rate Limit Dashboard", 1),
	})

	// Hit the endpoint over plain HTTP rather than the k8s REST client: the REST
	// client applies its own client-side QPS limit and auto-retries 429s, both of
	// which would mask what the server actually returns.
	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
	webhookURL := fmt.Sprintf(
		"http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/webhook",
		addr, repoName)

	// Fire well past the burst (2*rps) as fast as loopback allows. Even accounting
	// for token refill during the run, only a small fraction can be admitted, so
	// the rest must be throttled.
	const attempts = 100
	codes := make([]int, 0, attempts)
	for i := 0; i < attempts; i++ {
		req, err := http.NewRequestWithContext(t.Context(), http.MethodPost, webhookURL, http.NoBody)
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		_, _ = io.Copy(io.Discard, resp.Body)
		require.NoError(t, resp.Body.Close())

		codes = append(codes, resp.StatusCode)
	}

	// The first request draws from a full bucket, so it must not be throttled —
	// proving the limiter admits legitimate traffic rather than blocking blindly.
	assert.NotEqualf(t, http.StatusTooManyRequests, codes[0],
		"first request should pass the rate limiter; got codes %v", codes)

	throttled := 0
	for _, c := range codes {
		if c == http.StatusTooManyRequests {
			throttled++
		}
	}
	assert.Positivef(t, throttled,
		"expected the rate limiter to reject some requests with 429; got codes %v", codes)
}

// TestIntegrationProvisioning_WebhookRateLimitTrustedIPHeader verifies the
// limiter keys on the configured trusted IP header (webhook_trusted_ip_header =
// X-Real-Ip) rather than the TCP peer. Every request originates from the same
// loopback peer, so if the limiter keyed on the peer they'd all share one
// bucket.
func TestIntegrationProvisioning_WebhookRateLimitTrustedIPHeader(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "webhook-rl-header"
	helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("rl-hdr-dash", "Rate Limit Header Dashboard", 1),
	})

	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
	webhookURL := fmt.Sprintf(
		"http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/webhook",
		addr, repoName)

	post := func(t *testing.T, clientIP string) int {
		t.Helper()
		req, err := http.NewRequestWithContext(t.Context(), http.MethodPost, webhookURL, http.NoBody)
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set(trustedIPHeader, clientIP)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		_, _ = io.Copy(io.Discard, resp.Body)
		require.NoError(t, resp.Body.Close())
		return resp.StatusCode
	}

	// Documentation-range test IPs (RFC 5737); both arrive from the same loopback
	// peer, so the trusted header is the only thing distinguishing them.
	const floodedIP = "203.0.113.1"
	const otherIP = "198.51.100.7"

	// A fresh bucket admits the first request — the "reached the handler" marker
	// we compare the other-IP probes against (a git repo can't take webhooks, so
	// the handler answers with a non-429 4xx).
	baseline := post(t, floodedIP)
	require.NotEqual(t, http.StatusTooManyRequests, baseline, "a fresh trusted IP must pass the limiter")

	// Saturate the flooded IP's bucket.
	const attempts = 100
	throttledHeader := 0
	for i := 0; i < attempts; i++ {
		if post(t, floodedIP) == http.StatusTooManyRequests {
			throttledHeader++
		}
	}
	require.Positive(t, throttledHeader, "the flooded X-Real-Ip should be throttled")

	// A different X-Real-Ip is an independent bucket and must stay unaffected
	// while the flooded IP is throttled — even though it shares the same peer.
	for i := 0; i < 3; i++ {
		code := post(t, otherIP)
		assert.NotEqualf(t, http.StatusTooManyRequests, code,
			"a different trusted IP must have its own bucket (probe %d)", i)
		assert.Equalf(t, baseline, code,
			"a different trusted IP should reach the handler like a normal delivery (probe %d)", i)
	}
}

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

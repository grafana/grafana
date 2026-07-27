package ratelimit

import (
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

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

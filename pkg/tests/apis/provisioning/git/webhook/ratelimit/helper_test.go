package ratelimit

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// webhookRateLimitRPS is the sustained per-client rate the env configures. The
// limiter's burst is twice this (see webhooks/ratelimit.go), so a flood well
// above 2*rps is guaranteed to be throttled.
const webhookRateLimitRPS = 5

// This package runs in its own shared env so the webhook rate limiter's
// per-client bucket is not shared with — and drained by — the unrelated webhook
// tests next door.
// trustedIPHeader is the header the limiter keys on in this env. Requests that
// omit it fall back to the TCP peer (loopback), which is what the peer-keyed
// tests rely on; the header-keyed test sends it explicitly.
const trustedIPHeader = "X-Real-Ip"

var env = common.NewSharedGitEnv(
	common.WithProvisioningWebhookRateLimitRPS(webhookRateLimitRPS),
	common.WithProvisioningWebhookTrustedIPHeader(trustedIPHeader),
	// Match the sibling webhook env so the webhook connector is wired the same
	// way (public root URL makes the endpoint "enabled"; github is registered
	// alongside git).
	common.WithProvisioningPublicRootURL("https://grafana.example.com"),
	common.WithRepositoryTypes([]string{"git", "github", "local"}),
)

func sharedGitHelper(t *testing.T) *common.GitTestHelper {
	t.Helper()
	return env.GetCleanHelper(t)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

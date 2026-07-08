package relist

import (
	"testing"
	"time"

	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// env starts a shared Grafana server with the embedded NATS bus enabled but the
// SQL KV backend left off (common.WithNATSReListOnly), so no watch
// notifications are ever published. The provisioning informers run on the NATS
// path but receive no live events, which isolates the periodic re-list as the
// sole reconcile driver. The short resync keeps that re-list within a test's
// budget. This is its own package because the config is incompatible with the
// live-delivery packages (which need the KV backend on and the re-list pushed
// far out).
var env = common.NewSharedEnv(common.WithNATSReListOnly(2 * time.Second))

const (
	// reListWait bounds how long reconciliation via the periodic re-list may
	// take. It is a comfortable multiple of the 2s resync so the assertion is
	// not tight, while staying short enough to keep the test quick.
	reListWait = 30 * time.Second
	reListTick = 200 * time.Millisecond
)

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	helper := env.GetCleanHelper(t)
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient()
	return helper
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

package nats

import (
	"testing"
	"time"

	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// env starts a single shared Grafana server with the embedded NATS bus and the
// SQL KV storage backend enabled (common.WithNATS). The provisioning
// controllers therefore reconcile off NATS-delivered resource-change
// notifications instead of the apiserver watch.
//
// WithNATS also pushes the informer re-list and the job driver's fallback poll
// out to 10 minutes. That is what makes these tests proofs of live delivery
// rather than smoke tests: any reconcile or job pickup observed within
// liveDeliveryWait (well under 10 minutes) cannot be explained by the periodic
// LIST/poll — it can only have been driven by a NATS notification.
var env = common.NewSharedEnv(common.WithNATS())

const (
	// liveDeliveryWait bounds how long a reconcile driven by a live NATS
	// notification may take. It must stay far below the 10-minute re-list/poll
	// interval set by WithNATS so a reconcile within it is attributable to NATS,
	// yet be generous enough to absorb bus warm-up and slow CI.
	liveDeliveryWait = 20 * time.Second
	liveDeliveryTick = 200 * time.Millisecond
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

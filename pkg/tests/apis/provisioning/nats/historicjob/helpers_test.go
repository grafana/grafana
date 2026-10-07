package historicjob

import (
	"testing"
	"time"

	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// env starts a shared Grafana server with NATS enabled (via common.WithNATS)
// and a deliberately short history_expiration. HistoricJob is the one
// provisioning CRD whose informer has no live NATS events — it is re-list only
// (nil newObject) — so its cleanup controller is driven entirely by the
// periodic LIST. The short expiration lets that listing-driven cleanup run
// within a test's budget. This lives in its own package because the short
// expiration would race the other packages' historic-job reads.
var env = common.NewSharedEnv(
	common.WithNATS(),
	// Short retention: it is both how long a HistoricJob lives and the
	// historic-job informer's resync, so it bounds how quickly the
	// listing-driven cleanup runs. Kept small to keep the test fast; the poll
	// loop tolerates the correspondingly small observation window.
	common.WithProvisioningHistoryExpiration(3*time.Second),
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

package relistkeys

import (
	"testing"
	"time"

	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// env is the sibling relist package's setup with [provisioning] keys_only_relist
// turned on: embedded NATS, the SQL KV backend off so nothing publishes watch
// notifications, and a short resync. The re-list is therefore the only reconcile
// driver, and it asks storage for keys rather than whole objects. Its own package
// because the setting is server-wide, which leaves the relist package covering
// the full-object path and this one covering the projection.
var env = common.NewSharedEnv(common.WithNATSReListOnly(2*time.Second), common.WithKeysOnlyReList())

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	helper := env.GetCleanHelper(t)
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient()
	return helper
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

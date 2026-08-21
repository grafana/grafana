package maxbytes

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// testMaxFileSize is the per-file cap installed in the shared git test server.
// It maps to nanogit's SingleObjectFetchMaxBytes, so single-object git fetches
// (GetBlobByPath) over the cap are aborted mid-read. Small enough that fixtures
// stay cheap; large enough that ordinary fixtures fit comfortably under it.
const testMaxFileSize int64 = 4 * 1024

var env = common.NewSharedGitEnv(
	common.WithoutProvisioningFolderMetadata,
	common.WithProvisioningMaxFileSize(testMaxFileSize),
)

func sharedGitHelper(t *testing.T) *common.GitTestHelper {
	t.Helper()
	return env.GetCleanHelper(t)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

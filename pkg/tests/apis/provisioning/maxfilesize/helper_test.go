package maxfilesize

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// testMaxFileSize is the per-file cap installed in the shared test server.
// Small enough that fixtures stay cheap; large enough that ordinary
// fixtures (text-options.json etc.) still fit comfortably under it.
const testMaxFileSize int64 = 4 * 1024

var env = common.NewSharedEnv(
	common.WithoutProvisioningFolderMetadata,
	common.WithProvisioningMaxFileSize(testMaxFileSize),
)

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	return env.GetCleanHelper(t)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

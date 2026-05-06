package incrementaldiffthreshold

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// testMaxIncrementalChanges is the controller-side incremental-sync size
// threshold used by tests in this package. A small value keeps fixtures tiny:
// above-threshold tests push (value + 1) files, below-threshold tests fewer.
const testMaxIncrementalChanges = 5

var env = common.NewSharedGitEnv(
	common.WithoutProvisioningFolderMetadata,
	common.WithProvisioningMaxIncrementalChanges(testMaxIncrementalChanges),
)

func sharedGitHelper(t *testing.T) *common.GitTestHelper {
	t.Helper()
	return env.GetCleanHelper(t)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

package incrementaldiffthreshold

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// testMaxIncrementalDiffSize is the controller-side diff-size threshold used by
// tests in this package. A small value keeps the fixtures tiny: above-threshold
// tests push (value + 1) files, below-threshold tests push fewer.
const testMaxIncrementalDiffSize = 5

var env = common.NewSharedGitEnv(
	common.WithoutProvisioningFolderMetadata,
	common.WithProvisioningMaxIncrementalDiffSize(testMaxIncrementalDiffSize),
)

func sharedGitHelper(t *testing.T) *common.GitTestHelper {
	t.Helper()
	return env.GetCleanHelper(t)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

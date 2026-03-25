package disabledfeatures

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

var env = common.NewSharedEnv(common.WithoutExportFeatureFlag)

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	return env.GetCleanHelper(t)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

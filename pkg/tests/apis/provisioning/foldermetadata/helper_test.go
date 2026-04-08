package foldermetadata

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

var env = common.NewSharedGitEnv(
	common.WithRepositoryTypes([]string{"git", "local"}),
)

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	return env.GetCleanHelper(t).ProvisioningTestHelper
}

func sharedGitHelper(t *testing.T) *common.GitTestHelper {
	t.Helper()
	return env.GetCleanHelper(t)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

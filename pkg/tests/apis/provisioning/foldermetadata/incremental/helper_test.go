package incremental

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

var (
	sharedGitEnvWithFolderMetadata = common.NewSharedGitEnv(common.WithProvisioningFolderMetadata)
)

func TestMain(m *testing.M) {
	sharedGitEnvWithFolderMetadata.RunTestMain(m)
}

func sharedGitHelper(t *testing.T) *common.GitTestHelper {
	t.Helper()
	return sharedGitEnvWithFolderMetadata.GetCleanHelper(t)
}

package git

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

var env = common.NewSharedGitEnv(common.WithoutProvisioningFolderMetadata, common.WithConnectionTypes([]string{"github", "gitOAuth"}))

func sharedGitHelper(t *testing.T) *common.GitTestHelper {
	t.Helper()
	return env.GetCleanHelper(t)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

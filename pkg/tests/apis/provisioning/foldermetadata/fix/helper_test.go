package fix

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	gitcommon "github.com/grafana/grafana/pkg/tests/apis/provisioning/git/common"
)

var env = gitcommon.NewSharedGitEnv(common.WithProvisioningFolderMetadata)

func sharedGitHelper(t *testing.T) *gitcommon.GitTestHelper {
	t.Helper()
	return env.GetCleanHelper(t)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

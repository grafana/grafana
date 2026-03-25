package foldermetadatafiles

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	gitcommon "github.com/grafana/grafana/pkg/tests/apis/provisioning/git/common"
)

var (
	sharedGitEnvWithFolderMetadata = gitcommon.NewSharedGitEnv(common.WithProvisioningFolderMetadata)
)

func TestMain(m *testing.M) {
	sharedGitEnvWithFolderMetadata.RunTestMain(m)
}

func sharedGitHelper(t *testing.T) *gitcommon.GitTestHelper {
	t.Helper()
	return sharedGitEnvWithFolderMetadata.GetCleanHelper(t)
}

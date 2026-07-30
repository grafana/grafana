package webhook

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
)

var env = common.NewSharedGitEnv(
	common.WithoutProvisioningFolderMetadata,
	common.WithProvisioningPublicRootURL("https://grafana.example.com"),
	common.WithRepositoryTypes([]string{"git", "github"}),
)

func sharedGitHelper(t *testing.T) *common.GitTestHelper {
	t.Helper()
	helper := env.GetCleanHelper(t)
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient()
	return helper
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

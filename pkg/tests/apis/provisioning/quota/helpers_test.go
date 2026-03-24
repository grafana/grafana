package quota

import (
	"os"
	"path/filepath"
	"testing"

	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

var env = common.NewSharedEnv()

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	helper := env.GetCleanHelper(t)
	helper.SetQuotaStatus(provisioning.QuotaStatus{})
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient()
	cleanProvisioningDir(t, helper.ProvisioningPath)
	return helper
}

func cleanProvisioningDir(t *testing.T, dir string) {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		require.NoError(t, os.RemoveAll(filepath.Join(dir, entry.Name())),
			"failed to clean provisioning dir entry %s", entry.Name())
	}
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

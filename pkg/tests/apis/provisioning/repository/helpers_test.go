package repository

import (
	"os"
	"path/filepath"
	"testing"

	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

var env = common.NewSharedEnv()

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	helper := env.GetCleanHelper(t)
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient()
	cleanProvisioningPath(t, helper.ProvisioningPath)
	return helper
}

// cleanProvisioningPath removes all files and directories inside the shared
// provisioning directory without removing the directory itself. This prevents
// leftover files from previous tests from leaking into subsequent ones.
func cleanProvisioningPath(t *testing.T, dir string) {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		require.NoError(t, os.RemoveAll(filepath.Join(dir, entry.Name())),
			"failed to clean provisioning path entry %s", entry.Name())
	}
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

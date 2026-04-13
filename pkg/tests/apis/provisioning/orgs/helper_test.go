package orgs

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

var env = common.NewSharedEnv(
	common.WithoutProvisioningFolderMetadata,
	func(opts *testinfra.GrafanaOpts) {
		opts.SecretsManagerEnableDBMigrations = true
	},
	common.WithoutExportFeatureFlag,
)

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	return common.SharedHelper(t, env)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

// copyToPath copies a test file from testdata to a custom path
func copyToPath(t *testing.T, h *common.ProvisioningTestHelper, from, targetDir, to string) {
	t.Helper()

	// Read source file from testdata
	sourceFile := filepath.Join(h.ProvisioningPath, "..", "testdata", from)
	content, err := os.ReadFile(sourceFile)
	require.NoError(t, err, "should read source file %s", from)

	// Create target directory structure
	targetPath := filepath.Join(targetDir, to)
	targetDirPath := filepath.Dir(targetPath)
	err = os.MkdirAll(targetDirPath, 0o750)
	require.NoError(t, err, "should create target directory %s", targetDirPath)

	// Write to target
	err = os.WriteFile(targetPath, content, 0o600)
	require.NoError(t, err, "should write file to %s", targetPath)
}

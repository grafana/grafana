package orgs

import (
	"testing"

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

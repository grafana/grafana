package folderscope

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

// env runs a single shared Grafana for this package configured so that dashboards are
// declared WITHOUT the folder capability — i.e. treated as org-scoped. Folders keep the
// capability so the folder/instance sync targets still function. This lets the test
// exercise the SetFolder guard end-to-end purely through the [provisioning] resources
// configuration, without spinning up a second server (process-global state makes more
// than one Grafana per test process unreliable).
var env = common.NewSharedEnv(
	common.WithoutProvisioningFolderMetadata,
	common.WithoutExportFeatureFlag,
	func(opts *testinfra.GrafanaOpts) {
		opts.ProvisioningResources = []string{
			"folder.grafana.app/Folder:folder",
			"dashboard.grafana.app/Dashboard",
		}
	},
)

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	return common.SharedHelper(t, env)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

package collections

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

// One collection per pattern shape. Nothing serves a member of any of them here, which is the
// interesting case: the collections are declared, discovery runs, and the pipeline is unaffected.
const (
	datasourceCollection = "datasource.grafana.app"
	extCollection        = "ext.grafana.app"
	settingsCollection   = "plugins.grafana.app"
)

// env declares three kinds as collections, so the consumers of the configured set — settings
// endpoint, job admission, client factory — run against a real server.
var env = common.NewSharedEnv(
	common.WithoutProvisioningFolderMetadata,
	common.WithoutExportFeatureFlag,
	func(opts *testinfra.GrafanaOpts) {
		opts.ProvisioningResources = []string{
			"folder.grafana.app/Folder:folder",
			"dashboard.grafana.app/Dashboard:folder",
			"*." + datasourceCollection + "/DataSource",
			"*." + extCollection + "/Thing",
			"*-app@" + settingsCollection + "/Settings",
		}
	},
)

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	return common.SharedHelper(t, env)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

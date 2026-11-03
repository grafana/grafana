package collections

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

// The two collections a wildcard can name today. Data source plugins serve a group each inside a
// single storage collection; app plugins serve a group each under ext. Nothing serves a member of
// either here, which is the interesting case: the wildcards are still declared, discovery still
// runs, and the pipeline must be unaffected.
const (
	datasourceCollection = "datasource.grafana.app"
	pluginCollection     = "ext.grafana.app"
)

// env runs a single shared Grafana for this package with two kinds declared as wildcards, so the
// consumers of the configured set (the settings endpoint, the job admission validator and the
// client factory) are exercised against a real server.
var env = common.NewSharedEnv(
	common.WithoutProvisioningFolderMetadata,
	common.WithoutExportFeatureFlag,
	func(opts *testinfra.GrafanaOpts) {
		opts.ProvisioningResources = []string{
			"folder.grafana.app/Folder:folder",
			"dashboard.grafana.app/Dashboard:folder",
			"*." + datasourceCollection + "/DataSource",
			"*." + pluginCollection + "/Thing",
		}
	},
)

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	return common.SharedHelper(t, env)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

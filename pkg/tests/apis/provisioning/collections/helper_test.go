package collections

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

// collectionGroup is the group a storage collection is persisted under; its members each serve
// their own group inside it. Nothing serves a member here, which is the interesting case: the
// wildcard is still declared, discovery still runs, and the pipeline must be unaffected.
const collectionGroup = "datasource.grafana.app"

// env runs a single shared Grafana for this package with one kind declared as a wildcard over a
// storage collection, so the consumers of the configured set (the settings endpoint, the job
// admission validator and the client factory) are exercised against a real server.
var env = common.NewSharedEnv(
	common.WithoutProvisioningFolderMetadata,
	common.WithoutExportFeatureFlag,
	func(opts *testinfra.GrafanaOpts) {
		opts.ProvisioningResources = []string{
			"folder.grafana.app/Folder:folder",
			"dashboard.grafana.app/Dashboard:folder",
			"*." + collectionGroup + "/DataSource",
		}
	},
)

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	return common.SharedHelper(t, env)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

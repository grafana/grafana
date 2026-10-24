package bundle

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// The repository manages Bundles, plus a kind declared with the bundle capability so it
// may reference one. Dashboard stands in for a purpose-built consumer kind.
var env = common.NewSharedEnv(
	common.WithoutProvisioningFolderMetadata,
	common.WithProvisioningResources(
		"folder.grafana.app/Folder:folder",
		"provisioning.grafana.app/Bundle",
		"dashboard.grafana.app/Dashboard:folder:bundle",
	),
)

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	return env.GetCleanHelper(t)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

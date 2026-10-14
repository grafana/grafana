package bundle

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// bundleKind is the kind this package declares with the bundle capability.
//
// Dashboard stands in for a purpose-built bundle kind because it is the one kind exempt
// from strict field validation on write (see strictValidationExemptions in
// resources/parser.go), so a manifest carrying the platform-level top-level `files` block
// survives the apiserver write. A real bundle kind has to declare `files` in its own
// schema the way Repository declares `secure`, or be exempt likewise.
const bundleKind = "dashboard.grafana.app/Dashboard:folder:bundle"

var env = common.NewSharedEnv(
	common.WithoutProvisioningFolderMetadata,
	common.WithProvisioningResources("folder.grafana.app/Folder:folder", bundleKind),
)

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	return env.GetCleanHelper(t)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

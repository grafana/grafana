package resourcelister

import (
	"testing"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// The server runs with the reader that reads over HTTP selected. It serves those routes itself, so
// it keeps the index reader; what the setting has to leave working is asserted here, and the HTTP
// reader is pointed at the same server by the test.
var env = common.NewSharedEnv(
	common.WithoutProvisioningFolderMetadata,
	common.WithResourceLister(resources.ListerAPIs),
)

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	return env.GetCleanHelper(t)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

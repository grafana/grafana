package enterprise

import (
	"testing"

	"github.com/grafana/grafana/pkg/extensions"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

var env = common.NewSharedEnv(
	common.WithRepositoryTypes([]string{"github", "gitlab", "bitbucket"}),
)

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()

	if !extensions.IsEnterprise {
		t.Skip("Skipping enterprise integration test")
	}

	return env.GetCleanHelper(t)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

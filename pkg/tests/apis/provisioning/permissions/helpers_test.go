package permissions

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

var env = common.NewSharedEnv(func(o *testinfra.GrafanaOpts) { o.DisableAnonymous = true }, common.WithConnectionTypes([]string{"github", "githubOAuth"}))

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper { return common.SharedHelper(t, env) }

// Reuse one Grafana environment while sharedHelper resets fixtures between tests.
func TestMain(m *testing.M) { env.RunTestMain(m) }

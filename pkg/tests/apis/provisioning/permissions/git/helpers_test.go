package git

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

var env = common.NewSharedGitEnv(func(o *testinfra.GrafanaOpts) { o.DisableAnonymous = true }, common.WithProvisioningPublicRootURL("https://grafana.example.com"), common.WithRepositoryTypes([]string{"git", "github"}))

// Share Grafana and the local Git server, resetting their fixtures through sharedHelper.
func TestMain(m *testing.M)                           { env.RunTestMain(m) }
func sharedHelper(t *testing.T) *common.GitTestHelper { return env.GetCleanHelper(t) }

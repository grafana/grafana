package git

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

var env = common.NewSharedGitEnv(
	common.WithoutProvisioningFolderMetadata,
	common.WithConnectionTypes([]string{"github", "gitOAuth"}),
	func(opts *testinfra.GrafanaOpts) {
		// Backend attribution must work even while the retained frontend flag is disabled.
		opts.DisableFeatureToggles = append(opts.DisableFeatureToggles, featuremgmt.FlagProvisioningUserAttribution)
	},
)

func sharedGitHelper(t *testing.T) *common.GitTestHelper {
	t.Helper()
	return env.GetCleanHelper(t)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

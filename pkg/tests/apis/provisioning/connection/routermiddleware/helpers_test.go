package routermiddleware

import (
	"testing"

	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

var env = common.NewSharedEnv(
	common.WithConnectionTypes([]string{"github"}),
	func(opts *testinfra.GrafanaOpts) {
		opts.EnableFeatureToggles = append(opts.EnableFeatureToggles, featuremgmt.FlagGrafanaUseRouterMiddleware)
	},
)

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	helper := env.GetCleanHelper(t)
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient()
	return helper
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

package nats

import (
	"testing"

	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// env starts a single shared Grafana server with the embedded NATS bus and the
// SQL KV storage backend enabled (common.WithNATS). The provisioning
// controllers therefore reconcile off NATS-delivered resource-change
// notifications instead of the apiserver watch. See the package tests for the
// behaviors this validates.
var env = common.NewSharedEnv(common.WithNATS())

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	helper := env.GetCleanHelper(t)
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient()
	return helper
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

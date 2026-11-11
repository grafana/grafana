package apislister

import (
	"testing"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// env runs the whole provisioning pipeline with [provisioning] resource_lister = apis, so the
// managed-resource list and the repository stats never read the unified-storage managed-object
// index: every answer comes from listing the kinds through the groups that serve them.
var env = common.NewSharedEnv(
	common.WithoutProvisioningFolderMetadata,
	common.WithResourceLister(resources.ListerAPIs),
)

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	return common.SharedHelper(t, env)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

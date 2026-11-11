// Package namespaceresources covers the namespace-scoped resources route: the list of what a
// namespace holds and who manages it, which the frontend assembles from per-kind reads today.
package namespaceresources

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

var env = common.NewSharedEnv(
	common.WithoutProvisioningFolderMetadata,
	common.WithoutExportFeatureFlag,
)

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	return common.SharedHelper(t, env)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

// SPDX-License-Identifier: AGPL-3.0-only

package v1beta2

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

var env = common.NewSharedEnv(func(opts *testinfra.GrafanaOpts) {
	opts.SecretsManagerEnableDBMigrations = true
	opts.EnableFeatureToggles = append(opts.EnableFeatureToggles, featuremgmt.FlagProvisioningV1Beta2API)
})

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	return common.SharedHelper(t, env)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

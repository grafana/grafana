// SPDX-License-Identifier: AGPL-3.0-only

package v1beta1

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

var env = common.NewDefaultSharedEnv()

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	return common.SharedHelper(t, env)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

package legacy

import (
	"os/exec"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// The registry adapters and the rule service wrapper both call into this package. If this package
// reached either of them, a routed write could re-enter itself through the apiserver, so the
// dependency has to stay one-way. Go only rejects the cycle once both edges exist; this test rejects
// the first edge.
func TestLegacyDoesNotImportRegistryOrRuleService(t *testing.T) {
	if _, err := exec.LookPath("go"); err != nil {
		t.Skip("go toolchain not found")
	}

	out, err := exec.Command("go", "list", "-deps", "-f", "{{.ImportPath}}", ".").Output()
	require.NoError(t, err)

	const (
		registryPrefix = "github.com/grafana/grafana/pkg/registry/apps/"
		ruleService    = "github.com/grafana/grafana/pkg/services/ngalert/rules"
	)
	deps := strings.Fields(string(out))
	require.NotEmpty(t, deps)
	for _, dep := range deps {
		require.Falsef(t, strings.HasPrefix(dep, registryPrefix), "legacy must not depend on the registry package %s", dep)
		require.NotEqualf(t, ruleService, dep, "legacy must not depend on the rule service wrapper")
	}
}

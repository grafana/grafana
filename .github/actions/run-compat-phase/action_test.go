package compatphase

import (
	_ "embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"
)

//go:embed action.yml
var actionYAML []byte

func TestPhaseRunner(t *testing.T) {
	var action struct {
		Runs struct {
			Steps []struct {
				Run string
			}
		}
	}
	require.NoError(t, yaml.Unmarshal(actionYAML, &action))
	require.Len(t, action.Runs.Steps, 1)
	require.NotEmpty(t, action.Runs.Steps[0].Run)

	work := t.TempDir()
	checkout := filepath.Join(work, "checkout")
	binaries := filepath.Join(work, "bin")
	require.NoError(t, os.MkdirAll(filepath.Join(checkout, "pkg", "tests", "compat", "smoke"), 0o750))
	require.NoError(t, os.Mkdir(binaries, 0o750))

	build := exec.CommandContext(t.Context(), "go", "test", "-c", "-o", filepath.Join(binaries, "smoke.test"), "testdata/fixture_test.go")
	output, err := build.CombinedOutput()
	require.NoError(t, err, "%s", output)

	for _, tc := range []struct {
		name      string
		ownership string
	}{
		{name: "pass"},
		{name: "post-pass-failure", ownership: "package owned by @example/compat"},
		{name: "unknown-owner", ownership: "owners unknown"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			summary := filepath.Join(dir, "summary.md")
			log := filepath.Join(dir, "phase.log")
			require.NoError(t, os.WriteFile(summary, nil, 0o600))

			// Match the Bash options GitHub Actions uses for the inline step.
			cmd := exec.CommandContext(t.Context(), "bash", "--noprofile", "--norc", "-eo", "pipefail")
			cmd.Stdin = strings.NewReader(action.Runs.Steps[0].Run)
			cmd.Env = append(os.Environ(),
				"CHECKOUT="+checkout,
				"NEWER_CHECKOUT="+checkout,
				"NEWER_BINARIES="+binaries,
				"OLDER_BINARIES="+binaries,
				"GRAFANA_COMPAT_ROLE=older",
				"TEST=TestCompatSetup",
				"COMPAT_TEST_SCENARIO="+tc.name,
				"GRAFANA_COMPAT_DIR="+filepath.Join(dir, tc.name),
				"GITHUB_STEP_SUMMARY="+summary,
				"LOG="+log,
			)
			output, runErr := cmd.CombinedOutput()
			require.Contains(t, string(output), "--- PASS: TestCompatSetup")
			written, err := os.ReadFile(summary)
			require.NoError(t, err)
			if tc.ownership == "" {
				require.NoError(t, runErr, "%s", output)
				require.Empty(t, written)
				return
			}

			var exitErr *exec.ExitError
			require.ErrorAs(t, runErr, &exitErr, "%s", output)
			require.Equal(t, 1, exitErr.ExitCode(), "%s", output)
			row := fmt.Sprintf("- `smoke/TestCompatSetup` (older, %s) failed, %s\n", tc.name, tc.ownership)
			require.Equal(t, row, string(written))
			require.Contains(t, string(output), row)
			phaseLog, err := os.ReadFile(log)
			require.NoError(t, err)
			require.Contains(t, string(phaseLog), row)
			if tc.name == "unknown-owner" {
				require.Contains(t, string(output), "fixture: no CODEOWNERS entry")
				require.Contains(t, string(output), "::warning::Could not resolve package owners for smoke")
			}
		})
	}
}

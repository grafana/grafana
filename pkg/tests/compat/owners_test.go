package compat

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// codeowners has distinct teams, so the tests check lookup precedence and not who owns what today.
const codeowners = `
# a comment
/pkg/tests/compat/ @org/compat
/pkg/tests/compat/smoke/testdata/fixtured.grafana.app/ @org/fixture
/apps/alerting/ @org/alerting
/apps/shared/ @org/one @org/two
`

func TestResolveOwners(t *testing.T) {
	fixture, err := parseCodeowners(strings.NewReader(codeowners))
	require.NoError(t, err)
	const smoke = "pkg/tests/compat/smoke"
	for _, tc := range []struct {
		name  string
		paths []string
		want  string
	}{
		{"fixture directory entry wins", []string{smoke + "/testdata/fixtured.grafana.app", "apps/alerting", smoke}, "@org/fixture"},
		{"falls back to the app", []string{smoke + "/testdata/notifications.alerting.grafana.app", "apps/alerting", smoke}, "@org/alerting"},
		{"last path resolves to its parent entry", []string{smoke + "/testdata/none.grafana.app", "apps/none", smoke}, "@org/compat"},
		{"package", []string{"pkg/tests/compat/deep"}, "@org/compat"},
		{"several owners", []string{"apps/shared"}, "@org/one @org/two"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := resolveOwners(tc.paths, fixture, nil)
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}

	_, err = resolveOwners([]string{"pkg/other"}, fixture, nil)
	require.Error(t, err)
}

// writeTree writes the files, keyed by slash-separated path, below dir.
func writeTree(t *testing.T, dir string, files map[string]string) {
	t.Helper()
	for name, content := range files {
		full := filepath.Join(dir, filepath.FromSlash(name))
		require.NoError(t, os.MkdirAll(filepath.Dir(full), 0o750))
		require.NoError(t, os.WriteFile(full, []byte(content), 0o600))
	}
}

func TestLookupOwnersUsesEnterpriseCheckout(t *testing.T) {
	root := t.TempDir()
	writeTree(t, root, map[string]string{
		"grafana/.github/CODEOWNERS":           "/apps/alerting/ @org/alerting\n/pkg/tests/compat/ @org/compat\n",
		"grafana/go.mod":                       "module github.com/grafana/grafana\n\nreplace github.com/grafana/grafana-enterprise => ../enterprise\n",
		"enterprise/.github/CODEOWNERS":        "/pkg/apps/queries @org/sharing\n/pkg/apps/alerting @org/wrong\n/pkg/registry/sandboxsettings @org/sandbox\n",
		"grafana/pkg/tests/compat/smoke/.keep": "",
	})
	t.Chdir(filepath.Join(root, "grafana", "pkg", "tests", "compat", "smoke"))

	const smoke = "pkg/tests/compat/smoke"
	got, err := lookupOwners([]string{smoke + "/testdata/queries.grafana.app", "apps/queries", smoke})
	require.NoError(t, err)
	require.Equal(t, "@org/sharing", got, "an app only Enterprise owns")

	got, err = lookupOwners([]string{smoke + "/testdata/sandboxsettings.grafana.app", "apps/sandboxsettings", smoke})
	require.NoError(t, err)
	require.Equal(t, "@org/sandbox", got, "an app Enterprise keeps in its registry")

	got, err = lookupOwners([]string{smoke + "/testdata/alerting.grafana.app", "apps/alerting", smoke})
	require.NoError(t, err)
	require.Equal(t, "@org/alerting", got, "the OSS entry wins over Enterprise")

	got, err = lookupOwners([]string{smoke + "/testdata/none.grafana.app", "apps/none", smoke})
	require.NoError(t, err)
	require.Equal(t, "@org/compat", got, "no app owner anywhere falls back to the package")
}

func TestLookupOwnersReadsEnterpriseReplaceForms(t *testing.T) {
	root := t.TempDir()
	spaced := filepath.Join(root, "enterprise with spaces")
	for name, replace := range map[string]string{
		"relative":              "replace github.com/grafana/grafana-enterprise => ../enterprise\n",
		"absolute with spaces":  fmt.Sprintf("replace github.com/grafana/grafana-enterprise => %q\n", spaced),
		"block":                 "replace (\n\tgithub.com/grafana/grafana-enterprise => ../enterprise // overlay\n)\n",
		"another module before": "replace example.com/other => ../other\nreplace github.com/grafana/grafana-enterprise => ../enterprise\n",
	} {
		t.Run(name, func(t *testing.T) {
			dir := t.TempDir()
			writeTree(t, dir, map[string]string{
				"grafana/.github/CODEOWNERS":                "/pkg/tests/compat/ @org/compat\n",
				"grafana/go.mod":                            "module github.com/grafana/grafana\n\n" + strings.ReplaceAll(replace, spaced, filepath.Join(dir, "enterprise with spaces")),
				"enterprise/.github/CODEOWNERS":             "/pkg/apps/queries @org/sharing\n",
				"enterprise with spaces/.github/CODEOWNERS": "/pkg/apps/queries @org/sharing\n",
			})
			t.Chdir(filepath.Join(dir, "grafana"))
			got, err := lookupOwners([]string{"apps/queries", "pkg/tests/compat"})
			require.NoError(t, err)
			require.Equal(t, "@org/sharing", got)
		})
	}
}

// TestLookupOwnersFindsRepositoryEntry checks the lookup against the real file without
// naming a team, so an ownership transfer does not break it.
func TestLookupOwnersFindsRepositoryEntry(t *testing.T) {
	owners, err := lookupOwners([]string{PackagePath()})
	require.NoError(t, err)
	require.NotEmpty(t, owners)
}

func TestReportOwners(t *testing.T) {
	self, err := os.Executable()
	require.NoError(t, err)

	repo := t.TempDir()
	writeTree(t, repo, map[string]string{
		".github/CODEOWNERS":     "/pkg/tests/compat/ @org/compat\n/apps/resource-owned/ @org/resource\n",
		"pkg/tests/compat/.keep": "",
	})
	pkg := filepath.Join(repo, "pkg", "tests", "compat")

	for _, mode := range []string{"pass", "fail"} {
		t.Run(mode, func(t *testing.T) {
			// Keep the intentional failure out of the actual CI job summary.
			summary := filepath.Join(t.TempDir(), "summary.md")
			cmd := exec.Command(self, "-test.run=^TestReportOwnersHelper$", "-test.count=1") // #nosec G204 -- re-runs this test binary
			cmd.Dir = pkg
			cmd.Env = append(os.Environ(), "COMPAT_REPORT_OWNERS_MODE="+mode, "GITHUB_STEP_SUMMARY="+summary,
				EnvRole+"=newer", EnvDir+"="+filepath.Join(repo, "upgrade-rollback"))
			out, runErr := cmd.CombinedOutput()
			written, readErr := os.ReadFile(summary) // #nosec G304 -- file in the test's temp dir
			if mode == "pass" {
				require.NoError(t, runErr, string(out))
				require.ErrorIs(t, readErr, os.ErrNotExist)
				return
			}

			require.Error(t, runErr)
			require.Contains(t, string(out), "owned by @org/resource")
			require.NoError(t, readErr)
			require.Equal(t, "- `compat/TestReportOwnersHelper/resource` (newer, upgrade-rollback) failed, owned by @org/resource\n", string(written))
		})
	}
}

func TestReportOwnersHelper(t *testing.T) {
	mode := os.Getenv("COMPAT_REPORT_OWNERS_MODE")
	if mode == "" {
		t.Skip("runs only as a subprocess")
	}
	t.Run("resource", func(t *testing.T) {
		ReportOwners(t, "apps/resource-owned", PackagePath())
		if mode == "fail" {
			t.Fatal("intentional resource failure")
		}
	})
}

func TestPackageOwnersResolvesTheWorkingDirectory(t *testing.T) {
	repo := t.TempDir()
	writeTree(t, repo, map[string]string{
		".github/CODEOWNERS":           "/pkg/tests/compat/ @org/compat\n/pkg/tests/compat/deep/ @org/deep\n",
		"pkg/tests/compat/smoke/.keep": "",
		"pkg/tests/compat/deep/.keep":  "",
	})

	t.Chdir(filepath.Join(repo, "pkg", "tests", "compat", "smoke"))
	owners, err := packageOwners()
	require.NoError(t, err)
	require.Equal(t, "@org/compat", owners, "a package without an entry of its own")

	t.Chdir(filepath.Join(repo, "pkg", "tests", "compat", "deep"))
	owners, err = packageOwners()
	require.NoError(t, err)
	require.Equal(t, "@org/deep", owners)
}

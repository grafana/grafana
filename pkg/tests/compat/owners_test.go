package compat

import (
	"cmp"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"testing/synctest"
	"time"

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
	owners, err := lookupOwners([]string{PackagePath(t)})
	require.NoError(t, err)
	require.NotEmpty(t, owners)
}

func TestReportOwnersPhaseAndSubtests(t *testing.T) {
	self, err := os.Executable()
	require.NoError(t, err)
	for _, tc := range []struct {
		name string
		mode string
		args []string
		want int
		// owner is the team the entry must name, the package's unless a resource has its own.
		owner string
	}{
		{"a failure outside any subtest names the package owners", "phase", nil, 1, ""},
		{"a failing subtest is not reported a second time by its phase", "subtest", nil, 1, ""},
		{"a failure reported at once is not reported a second time by its phase", "now", nil, 1, ""},
		{"a shutdown failure after a resource failure is reported too", "shutdown", nil, 2, ""},
		{"a phase registered twice reports once", "twice", nil, 1, ""},
		{"a panic in a phase names the package owners", "panic-phase", nil, 1, ""},
		{"a panic in a resource names its owners, not the package's", "panic-subtest", nil, 1, "@org/resource"},
		{"a passing phase reports nothing", "pass", nil, 0, ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			// A repository of its own, so the owner does not depend on the real CODEOWNERS, and a
			// summary file of its own, so the intentional failures stay out of a CI job summary.
			repo := t.TempDir()
			pkg := filepath.Join(repo, "pkg", "tests", "compat")
			writeTree(t, repo, map[string]string{
				".github/CODEOWNERS":     "/pkg/tests/compat/ @org/compat\n/apps/resource-owned/ @org/resource\n",
				"pkg/tests/compat/.keep": "",
			})
			owner := "owned by " + cmp.Or(tc.owner, "@org/compat")
			summary := filepath.Join(repo, "summary.md")
			args := append([]string{"-test.run=^TestReportOwnersHelper$", "-test.count=1"}, tc.args...)
			cmd := exec.Command(self, args...) // #nosec G204 -- re-runs this test binary
			cmd.Dir = pkg
			cmd.Env = append(os.Environ(), "COMPAT_REPORT_OWNERS_MODE="+tc.mode, "GITHUB_STEP_SUMMARY="+summary,
				EnvRole+"=newer", EnvDir+"="+filepath.Join(repo, "upgrade-rollback"))
			out, _ := cmd.CombinedOutput() // a failing helper exits non-zero, which is the point
			require.Equal(t, tc.want, strings.Count(string(out), owner), string(out))
			written, err := os.ReadFile(summary) // #nosec G304 -- file in the test's temp dir
			if tc.want == 0 {
				require.ErrorIs(t, err, os.ErrNotExist)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.want, strings.Count(string(written), owner), string(written))
			require.Contains(t, string(written), "(newer, upgrade-rollback)", "which version and round trip failed")
			if tc.owner != "" {
				require.NotContains(t, string(written), "@org/compat", "a resource entry is not also reported to the package")
			}
			require.Contains(t, string(written), "`compat/TestReportOwnersHelper", "which package failed")
		})
	}
}

// TestReportOwnersHelper fails on purpose, in a subprocess of TestReportOwnersPhaseAndSubtests.
func TestReportOwnersHelper(t *testing.T) {
	mode := os.Getenv("COMPAT_REPORT_OWNERS_MODE")
	if mode == "" {
		t.Skip("runs only as a subprocess")
	}
	ReportOwners(t, PackagePath(t))
	switch mode {
	case "phase":
		t.Fatal("phase failure")
	case "panic-phase":
		panic("phase panic")
	case "panic-subtest":
		t.Run("resource", func(t *testing.T) {
			ReportOwners(t, "apps/resource-owned", PackagePath(t))
			panic("resource panic")
		})
	case "twice":
		ReportOwners(t, PackagePath(t))
		t.Fatal("phase failure")
	case "shutdown":
		t.Cleanup(func() { shutDown(t, func() error { return errors.New("server did not stop") }) })
		t.Run("resource", func(t *testing.T) {
			ReportOwners(t, PackagePath(t))
			t.Fatal("resource failure")
		})
	case "now":
		ReportOwnersNow(t, PackagePath(t))
		t.Fatal("failure reported at once")
	case "subtest":
		t.Run("resource", func(t *testing.T) {
			ReportOwners(t, PackagePath(t))
			t.Fatal("resource failure")
		})
	}
}

// watchedPhase runs a phase with the timeout watchdog on a fake clock, in a repository of its own.
func watchedPhase(t *testing.T, run func(entry string, stop func())) {
	t.Helper()
	synctest.Test(t, func(t *testing.T) {
		repo := t.TempDir()
		writeTree(t, repo, map[string]string{
			".github/CODEOWNERS":     "/pkg/tests/compat/ @org/compat\n",
			"pkg/tests/compat/.keep": "",
		})
		t.Chdir(filepath.Join(repo, "pkg", "tests", "compat"))
		dir := filepath.Join(repo, "upgrade-rollback")
		require.NoError(t, os.MkdirAll(dir, 0o750))
		t.Setenv(EnvRole, "older")
		t.Setenv(EnvDir, dir)
		entry := timeoutEntryPath("TestCompatSetup")
		require.Equal(t, filepath.Join(dir, "timeout-compat-TestCompatSetup.md"), entry)

		stop := watchTimeout(entry, "TestCompatSetup", time.Now().Add(20*time.Minute), []string{"pkg/tests/compat"})
		run(entry, stop)
	})
}

func TestWatchTimeoutLeavesNothingForAPhaseThatEndsInTime(t *testing.T) {
	watchedPhase(t, func(entry string, stop func()) {
		// Past the early report, before the deadline: the phase still ends in time.
		time.Sleep(20*time.Minute - 5*time.Second)
		synctest.Wait()
		_, err := os.Stat(entry) // #nosec G304 -- file in the test's temp dir
		require.NoError(t, err, "the watchdog leaves its candidate entry before the deadline")

		stop()
		_, err = os.Stat(entry) // #nosec G304 -- file in the test's temp dir
		require.ErrorIs(t, err, os.ErrNotExist, "a phase that ended in time is not a timeout")
	})
}

func TestWatchTimeoutLeavesTheEntryForAPhaseThatDoesNotEnd(t *testing.T) {
	watchedPhase(t, func(entry string, _ func()) {
		time.Sleep(20 * time.Minute)
		synctest.Wait()
		written, err := os.ReadFile(entry) // #nosec G304 -- file in the test's temp dir
		require.NoError(t, err)
		require.Equal(t, "- `compat/TestCompatSetup` (older, upgrade-rollback) timed out, owned by @org/compat\n", string(written))
	})
}

func TestWatchTimeoutWritesNothingWithoutADataDirectory(t *testing.T) {
	t.Setenv(EnvDir, "")
	require.Empty(t, timeoutEntryPath("TestCompatSetup"))
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

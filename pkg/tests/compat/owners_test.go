package compat

import (
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

	"github.com/grafana/grafana/pkg/infra/db"
)

func TestMain(m *testing.M) {
	mode := os.Getenv("COMPAT_REPORT_OWNERS_MODE")
	if mode == "cleanup-exit" {
		db.CleanupTestDB = func() { os.Exit(1) }
	}
	if mode != "" {
		Main(m)
	}
	os.Exit(m.Run())
}

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
	const (
		packageFailure  = "[compat-owner] owned by @org/compat"
		resourceFailure = "[compat-owner] owned by @org/resource"
		packagePanic    = "[compat-panic-owner] owned by @org/compat"
		resourcePanic   = "[compat-panic-owner] owned by @org/resource"
	)
	for _, tc := range []struct {
		name     string
		mode     string
		complete bool
		reports  []string
	}{
		{"a failure outside any subtest names the package owners", "phase", true, []string{packageFailure}},
		{"a failing subtest is not reported a second time by its phase", "subtest", true, []string{resourceFailure}},
		{"an unowned subtest failure falls back to the package", "unowned-subtest", true, []string{packageFailure}},
		{"a failure reported at once is not reported a second time by its phase", "now", true, []string{packageFailure}},
		{"a shutdown failure after a resource failure is reported too", "shutdown", true, []string{resourceFailure, packageFailure}},
		{"a phase registered twice reports once", "twice", true, []string{packageFailure}},
		{"a panic in a phase names the package owners", "panic-phase", false, []string{packagePanic}},
		{"a panic in a resource names only its owners", "panic-subtest", false, []string{resourcePanic}},
		{"a phase panic after a resource failure reports both owners", "resource-failure-then-panic", false, []string{resourceFailure, packagePanic}},
		{"a background panic after a resource failure leaves it to the runner to report the crash", "background-panic", false, []string{resourceFailure}},
		{"a resource failure followed by a database cleanup exit is incomplete", "cleanup-exit", false, []string{resourceFailure}},
		{"a passing phase reports nothing", "pass", true, nil},
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
			summary := filepath.Join(repo, "summary.md")
			cmd := exec.Command(self, "-test.run=^TestReportOwnersHelper$", "-test.count=1", "-test.v=test2json") // #nosec G204 -- re-runs this test binary
			cmd.Dir = pkg
			cmd.Env = append(os.Environ(), "COMPAT_REPORT_OWNERS_MODE="+tc.mode, "GITHUB_STEP_SUMMARY="+summary,
				EnvRole+"=newer", EnvDir+"="+filepath.Join(repo, "upgrade-rollback"), EnvPrintOwners+"=", "GRAFANA_TEST_DB=sqlite3")
			out, runErr := cmd.CombinedOutput()
			require.Equal(t, tc.complete, strings.Contains(string(out), "[compat-phase-complete]\n"), string(out))
			require.Equal(t, len(tc.reports), strings.Count(string(out), "-owner] owned by "), string(out))
			written, readErr := os.ReadFile(summary) // #nosec G304 -- file in the test's temp dir
			if len(tc.reports) == 0 {
				require.NoError(t, runErr, string(out))
				require.ErrorIs(t, readErr, os.ErrNotExist)
				return
			}
			require.Error(t, runErr)
			require.NoError(t, readErr)
			require.Equal(t, len(tc.reports), strings.Count(string(written), "failed, owned by "), string(written))
			for _, report := range tc.reports {
				require.Contains(t, string(out), report)
				_, owner, _ := strings.Cut(report, " owned by ")
				require.Contains(t, string(written), "owned by "+owner)
			}
			require.Contains(t, string(written), "(newer, upgrade-rollback)", "which version and round trip failed")
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
	resourceFailure := func(t *testing.T) {
		ReportOwners(t, "apps/resource-owned", PackagePath(t))
		t.Fatal("resource failure")
	}
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
		t.Run("resource", resourceFailure)
	case "now":
		ReportOwnersNow(t, PackagePath(t))
		t.Fatal("failure reported at once")
	case "subtest", "cleanup-exit":
		t.Run("resource", resourceFailure)
	case "unowned-subtest":
		t.Run("resource", func(t *testing.T) {
			ReportOwners(t, "apps/unowned")
			t.Fatal("unowned resource failure")
		})
	case "resource-failure-then-panic":
		t.Run("resource", resourceFailure)
		panic("phase panic")
	case "background-panic":
		t.Run("resource", resourceFailure)
		go func() { panic("background service panic") }()
		select {}
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

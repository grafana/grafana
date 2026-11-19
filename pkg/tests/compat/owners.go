package compat

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	"golang.org/x/mod/modfile"
)

// Track ordinary failures and panics separately so a resource failure doesn't
// suppress reporting of a subsequent panic in the phase.
type phaseReport struct {
	name     string
	panicked bool
}

// reported holds the phase reports that already named an owner.
var reported sync.Map

// phases holds the top-level tests that registered package-level reporting, so that a
// phase reporting through both NewHelper and its own entry point reports once.
var phases sync.Map

// ReportOwners names the owning team when t fails, so a red run says who should
// look at it. It logs the owners and, in GitHub Actions, adds them to the job summary.
//
// Paths are repository-relative directories, most specific first. The first one
// with its own CODEOWNERS entry wins; otherwise the last one resolves to its
// closest parent entry. An apps/<app> path also checks the CODEOWNERS of the
// grafana-enterprise checkout the build uses, which keeps its apps in pkg/apps/<app>
// or pkg/registry/<app>.
//
// Call it on a top-level test with the package path to cover failures outside any
// subtest. That report is skipped when a subtest already named its owners, because
// a failing subtest also fails its parent.
func ReportOwners(t *testing.T, paths ...string) {
	t.Helper()
	root, _, isSubtest := strings.Cut(t.Name(), "/")
	if !isSubtest {
		if _, registered := phases.LoadOrStore(root, true); registered {
			return
		}
	}
	if deadline, ok := t.Deadline(); ok && !isSubtest {
		stop := watchTimeout(timeoutEntryPath(t.Name()), t.Name(), deadline, paths)
		t.Cleanup(stop)
	}
	t.Cleanup(func() {
		if !isSubtest {
			defer phases.Delete(root)
			defer reported.Delete(phaseReport{name: root})
			defer reported.Delete(phaseReport{name: root, panicked: true})
		}
		panicked := panicking()
		if !t.Failed() && !panicked {
			return
		}
		key := phaseReport{name: root, panicked: panicked}
		if !isSubtest {
			if _, done := reported.Load(key); done {
				return
			}
		}
		if logOwners(t, paths, panicked) && isSubtest {
			reported.Store(key, true)
		}
	})
}

// ReportOwnersNow names the owners of a failure that t is about to raise itself, for
// failures that cannot run in a subtest of their own. It replaces the report that
// ReportOwners registered on the same top-level test would make for that failure.
func ReportOwnersNow(t *testing.T, paths ...string) {
	t.Helper()
	root, _, _ := strings.Cut(t.Name(), "/")
	if logOwners(t, paths, false) {
		reported.Store(phaseReport{name: root}, true)
	}
}

// panicking reports whether the caller runs while a panic unwinds. The testing package runs the
// cleanups of a test that panicked before it marks the test failed, and a cleanup cannot
// recover the panic, so t.Failed() alone would skip the report of a panicking test.
func panicking() bool {
	pcs := make([]uintptr, 32)
	frames := runtime.CallersFrames(pcs[:runtime.Callers(2, pcs)])
	for {
		frame, more := frames.Next()
		if frame.Function == "runtime.gopanic" {
			return true
		}
		if !more {
			return false
		}
	}
}

func logOwners(t *testing.T, paths []string, panicked bool) bool {
	t.Helper()
	owners, err := lookupOwners(paths)
	if err != nil {
		t.Logf("could not look up owners: %v", err)
		return false
	}
	if summary := os.Getenv("GITHUB_STEP_SUMMARY"); summary != "" {
		if err := appendLine(summary, fmt.Sprintf("- `%s`%s failed, owned by %s\n", qualified(t.Name()), phaseLabel(), owners)); err != nil {
			t.Logf("could not write job summary: %v", err)
		}
	}
	// The runner can match these markers regardless of which caller Go attributes the log to.
	if panicked {
		t.Logf("[compat-panic-owner] owned by %s", owners)
	} else {
		t.Logf("[compat-owner] owned by %s", owners)
	}
	return true
}

// watchTimeout leaves the owners of a phase that is about to hit the test timeout in the
// file entry, a little before the deadline. The testing package then panics outside the
// running test, which never runs its cleanups, so nothing else would report a hung phase.
// The file is only a candidate: the phase runner adds it to the job summary when the phase
// did not end, and stop, which the test runs when it ends, removes it, so a phase that
// finishes inside the margin leaves no entry in a passing job.
func watchTimeout(entry, name string, deadline time.Time, paths []string) (stop func()) {
	var (
		mu      sync.Mutex
		stopped bool
	)
	remaining := time.Until(deadline)
	// Early enough to write before the panic ends the process.
	timer := time.AfterFunc(remaining-min(10*time.Second, remaining/10), func() {
		mu.Lock()
		defer mu.Unlock()
		if stopped {
			return
		}
		owners, err := lookupOwners(paths)
		if err != nil {
			fmt.Fprintf(os.Stderr, "%s is about to time out; could not look up owners: %v\n", name, err)
			return
		}
		fmt.Fprintf(os.Stderr, "%s is about to time out, owned by %s\n", name, owners)
		if entry == "" {
			return
		}
		line := fmt.Sprintf("- `%s`%s timed out, owned by %s\n", qualified(name), phaseLabel(), owners)
		if err := os.WriteFile(entry, []byte(line), 0o600); err != nil {
			fmt.Fprintf(os.Stderr, "could not write %s: %v\n", entry, err)
		}
	})
	return func() {
		mu.Lock()
		defer mu.Unlock()
		stopped = true
		timer.Stop()
		if entry != "" {
			_ = os.Remove(entry)
		}
	}
}

// timeoutEntryPath is where the watchdog of a phase leaves its entry, in the data directory
// of the round trip, named for the package and the phase so that the phase runner finds it.
// It is empty outside the workflow, where there is no job summary to add it to.
func timeoutEntryPath(name string) string {
	dir := os.Getenv(EnvDir)
	if dir == "" {
		return ""
	}
	wd, err := os.Getwd()
	if err != nil {
		return ""
	}
	return filepath.Join(dir, "timeout-"+filepath.Base(wd)+"-"+name+".md")
}

// qualified prefixes a test name with its package, because the packages of one round trip
// run the same phases and their entries would otherwise look alike.
func qualified(name string) string {
	wd, err := os.Getwd()
	if err != nil {
		return name
	}
	return filepath.Base(wd) + "/" + name
}

// phaseLabel names the version and the round trip a phase runs in, like " (newer,
// upgrade-rollback)", because a phase runs once per version and a summary entry
// would not say which one failed. It is empty for a run outside the workflow.
func phaseLabel() string {
	var parts []string
	if role := os.Getenv(EnvRole); role != "" {
		parts = append(parts, role)
	}
	if dir := os.Getenv(EnvDir); dir != "" {
		parts = append(parts, filepath.Base(dir))
	}
	if len(parts) == 0 {
		return ""
	}
	return " (" + strings.Join(parts, ", ") + ")"
}

// PackagePath returns the repository-relative path of the current test package, or ""
// when the repository root cannot be found, like in a checkout without .github. A
// failing test then logs the lookup error instead of failing every test up front.
func PackagePath(t *testing.T) string {
	t.Helper()
	return packagePath()
}

func packagePath() string {
	root, err := repoRoot()
	if err != nil {
		return ""
	}
	wd, err := os.Getwd()
	if err != nil {
		return ""
	}
	rel, err := filepath.Rel(root, wd)
	if err != nil {
		return ""
	}
	return filepath.ToSlash(rel)
}

// packageOwners returns the owners of the package in the working directory, for the phase
// runner to name when a phase ends without reporting any, like after a crash of the process.
func packageOwners() (string, error) {
	return lookupOwners([]string{packagePath()})
}

func lookupOwners(paths []string) (string, error) {
	root, err := repoRoot()
	if err != nil {
		return "", err
	}
	oss, err := readCodeowners(filepath.Join(root, ".github", "CODEOWNERS"))
	if err != nil {
		return "", err
	}
	return resolveOwners(paths, oss, enterpriseCodeowners(root))
}

// enterpriseCodeowners reads the CODEOWNERS of the grafana-enterprise checkout that the
// build overlay points go.mod at. It returns nil for an OSS build, which has none.
func enterpriseCodeowners(root string) map[string]string {
	raw, err := os.ReadFile(filepath.Join(root, "go.mod")) // #nosec G304 -- go.mod of the repository the tests run in
	if err != nil {
		return nil
	}
	mod, err := modfile.Parse("go.mod", raw, nil)
	if err != nil {
		return nil
	}
	for _, r := range mod.Replace {
		if r.Old.Path != "github.com/grafana/grafana-enterprise" {
			continue
		}
		dir := r.New.Path
		if !filepath.IsAbs(dir) {
			dir = filepath.Join(root, dir)
		}
		entries, err := readCodeowners(filepath.Join(dir, ".github", "CODEOWNERS"))
		if err != nil {
			return nil
		}
		return entries
	}
	return nil
}

func readCodeowners(file string) (map[string]string, error) {
	f, err := os.Open(file) // #nosec G304 G703 -- CODEOWNERS of the repository the tests run in, or of the grafana-enterprise checkout its go.mod points at
	if err != nil {
		return nil, err
	}
	defer func() { _ = f.Close() }()
	return parseCodeowners(f)
}

// parseCodeowners maps each entry's path, without the surrounding slashes, to its owners.
// Only plain directory and file entries are supported, which is all compat paths need.
func parseCodeowners(r io.Reader) (map[string]string, error) {
	entries := map[string]string{}
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 || strings.HasPrefix(fields[0], "#") {
			continue
		}
		entries[strings.Trim(fields[0], "/")] = strings.Join(fields[1:], " ")
	}
	return entries, scanner.Err()
}

func resolveOwners(paths []string, oss, enterprise map[string]string) (string, error) {
	for i, p := range paths {
		p = strings.Trim(p, "/")
		if owners, ok := oss[p]; ok {
			return owners, nil
		}
		if app, ok := strings.CutPrefix(p, "apps/"); ok {
			// Enterprise keeps some apps in pkg/apps and others in pkg/registry.
			for _, dir := range []string{"pkg/apps/", "pkg/registry/"} {
				if owners, ok := enterprise[dir+app]; ok {
					return owners, nil
				}
			}
		}
		if i < len(paths)-1 {
			continue
		}
		for dir := p; dir != "." && dir != "/"; dir = path.Dir(dir) {
			if owners, ok := oss[dir]; ok {
				return owners, nil
			}
		}
	}
	return "", errors.New("no CODEOWNERS entry")
}

func repoRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, ".github", "CODEOWNERS")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", errors.New(".github/CODEOWNERS not found above the working directory")
		}
		dir = parent
	}
}

func appendLine(file, line string) error {
	f, err := os.OpenFile(file, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600) // #nosec G304 G703 -- job summary file named by GitHub Actions
	if err != nil {
		return err
	}
	if _, err := f.WriteString(line); err != nil {
		_ = f.Close()
		return err
	}
	return f.Close()
}

package compat

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/mod/modfile"
)

// ReportOwners logs the owning team when t fails and adds it to the GitHub Actions job summary.
//
// Paths are repository-relative directories, most specific first. The first one
// with its own CODEOWNERS entry wins; otherwise the last one resolves to its
// closest parent entry. An apps/<app> path also checks the CODEOWNERS of the
// grafana-enterprise checkout the build uses, which keeps its apps in pkg/apps/<app>
// or pkg/registry/<app>.
func ReportOwners(t *testing.T, paths ...string) {
	t.Cleanup(func() {
		if !t.Failed() {
			return
		}
		owners, err := lookupOwners(paths)
		if err != nil {
			t.Logf("could not look up owners: %v", err)
			return
		}
		t.Logf("owned by %s", owners)
		if summary := os.Getenv("GITHUB_STEP_SUMMARY"); summary != "" {
			if err := appendLine(summary, fmt.Sprintf("- `%s`%s failed, owned by %s\n", qualified(t.Name()), phaseLabel(), owners)); err != nil {
				t.Logf("could not write job summary: %v", err)
			}
		}
	})
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
func PackagePath() string {
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
// runner to name whenever a phase fails.
func packageOwners() (string, error) {
	return lookupOwners([]string{PackagePath()})
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

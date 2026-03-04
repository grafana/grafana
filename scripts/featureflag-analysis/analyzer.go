package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

type migrationStatus string

const (
	statusMigrated    migrationStatus = "migrated"
	statusPartial     migrationStatus = "partial"
	statusNotMigrated migrationStatus = "not_migrated"
	statusNoUsage     migrationStatus = "no_usage"
)

type flagInfo struct {
	Name  string
	Owner string
}

// fileIndex holds the content of files that match each broad pattern.
// We walk the repo once and store file contents in memory so per-flag
// lookups are fast string searches rather than repeated disk reads.
type fileIndex struct {
	beOld map[string]string // Go files containing "IsEnabled"
	beNew map[string]string // Go files containing "openfeature"
	feOld map[string]string // TS/TSX files containing "featureToggles" or "getFeatureToggle"
	feNew map[string]string // TS/TSX files containing "useBooleanFlagValue" or "getFeatureFlagClient"
}

func buildIndex(roots []string) (fileIndex, error) {
	idx := fileIndex{
		beOld: make(map[string]string),
		beNew: make(map[string]string),
		feOld: make(map[string]string),
		feNew: make(map[string]string),
	}

	for _, root := range roots {
		// Go files under pkg/
		if err := filepath.Walk(filepath.Join(root, "pkg"), func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if info.IsDir() || !strings.HasSuffix(path, ".go") {
				return nil
			}
			content, err := os.ReadFile(path)
			if err != nil {
				return nil
			}
			s := string(content)
			if strings.Contains(s, "IsEnabled") {
				idx.beOld[path] = s
			}
			if strings.Contains(s, "openfeature") {
				idx.beNew[path] = s
			}
			return nil
		}); err != nil {
			return idx, err
		}

		// TS/TSX files under public/ and packages/
		for _, dir := range []string{
			filepath.Join(root, "public"),
			filepath.Join(root, "packages"),
		} {
			if _, err := os.Stat(dir); os.IsNotExist(err) {
				continue
			}
			if err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
				if err != nil {
					return err
				}
				if info.IsDir() {
					return nil
				}
				if !strings.HasSuffix(path, ".ts") && !strings.HasSuffix(path, ".tsx") {
					return nil
				}
				content, err := os.ReadFile(path)
				if err != nil {
					return nil
				}
				s := string(content)
				if strings.Contains(s, "featureToggles") || strings.Contains(s, "getFeatureToggle") {
					idx.feOld[path] = s
				}
				if strings.Contains(s, "useBooleanFlagValue") || strings.Contains(s, "getFeatureFlagClient") {
					idx.feNew[path] = s
				}
				return nil
			}); err != nil {
				return idx, err
			}
		}
	}

	return idx, nil
}

func classifyFlag(name string, idx fileIndex) migrationStatus {
	flagConst := "Flag" + strings.ToUpper(name[:1]) + name[1:]

	// BE: string literal "flagName" or Go constant FlagXxx
	beOld := containsAny(idx.beOld, `"`+name+`"`, flagConst)
	beNew := containsAny(idx.beNew, `"`+name+`"`, flagConst)

	// FE old: property access config.featureToggles.flagName — match as whole word
	// to avoid false positives from substrings (e.g. "alert" in "alertingBacktesting")
	wbRe := regexp.MustCompile(`\b` + regexp.QuoteMeta(name) + `\b`)
	feOld := containsPattern(idx.feOld, wbRe)

	// FE new: quoted string literal 'flagName' or "flagName"
	feNew := containsAny(idx.feNew, `'`+name+`'`, `"`+name+`"`)

	return classify(beOld, beNew, feOld, feNew)
}

// classify is a pure function so it can be unit tested independently.
func classify(beOld, beNew, feOld, feNew bool) migrationStatus {
	beUsed := beOld || beNew
	feUsed := feOld || feNew

	beMigrated := beUsed && !beOld
	feMigrated := feUsed && !feOld

	switch {
	case !beUsed && !feUsed:
		return statusNoUsage
	case beUsed && feUsed:
		if beMigrated && feMigrated {
			return statusMigrated
		}
		if beMigrated || feMigrated {
			return statusPartial
		}
		return statusNotMigrated
	case beUsed:
		if beMigrated {
			return statusMigrated
		}
		return statusNotMigrated
	default: // feUsed only
		if feMigrated {
			return statusMigrated
		}
		return statusNotMigrated
	}
}

func containsAny(files map[string]string, patterns ...string) bool {
	for _, content := range files {
		for _, p := range patterns {
			if strings.Contains(content, p) {
				return true
			}
		}
	}
	return false
}

func containsPattern(files map[string]string, re *regexp.Regexp) bool {
	for _, content := range files {
		if re.MatchString(content) {
			return true
		}
	}
	return false
}

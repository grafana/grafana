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
	statusUnknown     migrationStatus = "unknown"
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
		// Go files under pkg/ and apps/
		for _, goDir := range []string{
			filepath.Join(root, "pkg"),
			filepath.Join(root, "apps"),
		} {
			if _, err := os.Stat(goDir); os.IsNotExist(err) {
				continue
			}
			if err := filepath.Walk(goDir, func(path string, info os.FileInfo, err error) error {
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

// classifyFlag returns the migration status for a flag, or ("", false) if the
// flag has no usage anywhere and should be skipped.
func classifyFlag(name string, idx fileIndex) (migrationStatus, bool) {
	flagConst := "Flag" + strings.ToUpper(name[:1]) + name[1:]

	// beOld: same-line check is reliable — IsEnabled calls are always single-line.
	// beNew: use a small window because client.Boolean(...) calls are sometimes
	// formatted across multiple lines (flag constant on a separate line from the call).
	beOld := flagOnSameLine(idx.beOld, []string{`"` + name + `"`, flagConst}, "IsEnabled")
	beNew := flagNearLine(idx.beNew, []string{`"` + name + `"`, flagConst}, 4, "Boolean", "BooleanValue")

	// FE old: property access config.featureToggles.flagName — match as whole word
	// to avoid false positives from substrings (e.g. "alert" in "alertingBacktesting")
	wbRe := regexp.MustCompile(`\b` + regexp.QuoteMeta(name) + `\b`)
	feOld := containsPattern(idx.feOld, wbRe)
	// FE new: quoted string literal 'flagName' or "flagName"
	feNew := containsAny(idx.feNew, `'`+name+`'`, `"`+name+`"`)

	s, ok := classify(beOld, beNew, feOld, feNew)
	return s, ok
}

// classify is a pure function so it can be unit tested independently.
// Returns (status, false) when the flag has no usage.
func classify(beOld, beNew, feOld, feNew bool) (migrationStatus, bool) {
	beUsed := beOld || beNew
	feUsed := feOld || feNew

	if !beUsed && !feUsed {
		return "", false
	}

	beMigrated := beUsed && !beOld
	feMigrated := feUsed && !feOld

	switch {
	case beUsed && feUsed:
		if beMigrated && feMigrated {
			return statusMigrated, true
		}
		if beMigrated || feMigrated {
			return statusPartial, true
		}
		return statusNotMigrated, true
	case beUsed:
		if beMigrated {
			return statusMigrated, true
		}
		return statusNotMigrated, true
	default: // feUsed only
		if feMigrated {
			return statusMigrated, true
		}
		return statusNotMigrated, true
	}
}

// isBEEasy returns true if every BE call site for the flag is safe to migrate.
// A call site is safe when:
//   - not in a wire file
//   - not in a startup-time function (constructors, providers, run loops, init)
//   - the flag result is not stored in a struct field
//   - context is passed at the call site
func isBEEasy(name string, idx fileIndex) bool {
	patterns := []string{`"` + name + `"`, "Flag" + strings.ToUpper(name[:1]) + name[1:]}

	for path, content := range idx.beOld {
		hasRef := false
		for _, p := range patterns {
			if strings.Contains(content, p) {
				hasRef = true
				break
			}
		}
		if !hasRef {
			continue
		}

		// Wire files are wired at startup.
		base := filepath.Base(path)
		if base == "wire.go" || base == "wire_gen.go" {
			return false
		}

		lines := strings.Split(content, "\n")
		for i, line := range lines {
			refFound := false
			for _, p := range patterns {
				if strings.Contains(line, p) {
					refFound = true
					break
				}
			}
			if !refFound {
				continue
			}

			funcDecl := enclosingFuncDecl(lines, i)
			funcName := extractFuncName(funcDecl)

			if isStartupFunc(funcName) {
				return false
			}

			// Result stored in a struct field (s.field = IsEnabled(...)) means it's
			// evaluated once and cached — flag changes won't take effect dynamically.
			for _, p := range patterns {
				if storedInField(line, p) {
					return false
				}
			}

			// Context must be passed at the call site.
			if !strings.Contains(line, "ctx") {
				return false
			}
		}
	}
	return true
}

// isStartupFunc reports whether a function name indicates startup-time execution.
func isStartupFunc(name string) bool {
	exact := map[string]bool{
		"init": true, "Run": true, "Start": true, "Background": true, "Initialize": true,
	}
	if exact[name] {
		return true
	}
	for _, prefix := range []string{"New", "Provide", "Init", "Setup", "Register", "Start", "Run"} {
		if strings.HasPrefix(name, prefix) {
			return true
		}
	}
	return false
}

// storedInField reports whether line stores the flag result in a struct field,
// e.g. "s.featureEnabled = featuremgmt.IsEnabled(ctx, flagConst)".
func storedInField(line, flagPattern string) bool {
	eqIdx := strings.Index(line, "=")
	if eqIdx < 0 {
		return false
	}
	flagIdx := strings.Index(line, flagPattern)
	if flagIdx <= eqIdx {
		return false // flag is on the left side or not present after =
	}
	lhs := strings.TrimSpace(line[:eqIdx])
	lhs = strings.TrimSuffix(lhs, ":") // strip := → :
	return strings.Contains(lhs, ".")
}

// enclosingFuncDecl scans backwards from line i to find the nearest func declaration.
func enclosingFuncDecl(lines []string, i int) string {
	for j := i; j >= 0; j-- {
		trimmed := strings.TrimSpace(lines[j])
		if strings.HasPrefix(trimmed, "func ") {
			// Collect up to 4 lines to handle multi-line signatures.
			end := min(j+4, len(lines))
			return strings.Join(lines[j:end], " ")
		}
	}
	return ""
}

// extractFuncName pulls the bare function/method name out of a declaration line,
// e.g. "func (s *Svc) HandleRequest(..." → "HandleRequest".
func extractFuncName(decl string) string {
	trimmed := strings.TrimSpace(decl)
	rest := trimmed
	if strings.HasPrefix(trimmed, "func (") {
		end := strings.Index(trimmed, ") ")
		if end < 0 {
			return ""
		}
		rest = strings.TrimSpace(trimmed[end+2:])
	} else if strings.HasPrefix(trimmed, "func ") {
		rest = trimmed[5:]
	} else {
		return ""
	}
	end := strings.IndexAny(rest, "([")
	if end < 0 {
		return rest
	}
	return rest[:end]
}

// flagOnSameLine reports whether any file contains a line that has both one of
// the flag patterns and one of the API call patterns. This avoids false positives
// from files that reference a flag constant for non-evaluation purposes.
func flagOnSameLine(files map[string]string, flagPatterns []string, apiPatterns ...string) bool {
	return flagNearLine(files, flagPatterns, 0, apiPatterns...)
}

// flagNearLine is like flagOnSameLine but also checks within window lines before/after
// the flag reference. Use for API calls that may be formatted across multiple lines.
func flagNearLine(files map[string]string, flagPatterns []string, window int, apiPatterns ...string) bool {
	for _, content := range files {
		lines := strings.Split(content, "\n")
		for i, line := range lines {
			hasFlag := false
			for _, fp := range flagPatterns {
				if strings.Contains(line, fp) {
					hasFlag = true
					break
				}
			}
			if !hasFlag {
				continue
			}
			start := max(0, i-window)
			end := min(len(lines), i+window+1)
			for _, nearby := range lines[start:end] {
				for _, ap := range apiPatterns {
					if strings.Contains(nearby, ap) {
						return true
					}
				}
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
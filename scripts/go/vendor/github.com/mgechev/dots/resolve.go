package dots

import (
	"go/build"
	"log"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
)

var (
	buildContext = build.Default
	goroot       = filepath.Clean(runtime.GOROOT())
	gorootSrc    = filepath.Join(goroot, "src")
)

func flatten(arr [][]string) []string {
	var res []string
	for _, e := range arr {
		res = append(res, e...)
	}
	return res
}

// Resolve accepts a slice of paths with optional "..." placeholder and a slice with paths to be skipped.
// The final result is the set of all files from the selected directories subtracted with
// the files in the skip slice.
func Resolve(includePatterns, skipPatterns []string) ([]string, error) {
	skip, err := resolvePatterns(skipPatterns)
	filter := newPathFilter(flatten(skip))
	if err != nil {
		return nil, err
	}

	pathSet := map[string]bool{}
	includePackages, err := resolvePatterns(includePatterns)
	include := flatten(includePackages)
	if err != nil {
		return nil, err
	}

	var result []string
	for _, i := range include {
		if _, ok := pathSet[i]; !ok && !filter(i) {
			pathSet[i] = true
			result = append(result, i)
		}
	}
	return result, err
}

// ResolvePackages accepts a slice of paths with optional "..." placeholder and a slice with paths to be skipped.
// The final result is the set of all files from the selected directories subtracted with
// the files in the skip slice. The difference between `Resolve` and `ResolvePackages`
// is that `ResolvePackages` preserves the package structure in the nested slices.
func ResolvePackages(includePatterns, skipPatterns []string) ([][]string, error) {
	skip, err := resolvePatterns(skipPatterns)
	filter := newPathFilter(flatten(skip))
	if err != nil {
		return nil, err
	}

	pathSet := map[string]bool{}
	include, err := resolvePatterns(includePatterns)
	if err != nil {
		return nil, err
	}

	var result [][]string
	for _, p := range include {
		var packageFiles []string
		for _, f := range p {
			if _, ok := pathSet[f]; !ok && !filter(f) {
				pathSet[f] = true
				packageFiles = append(packageFiles, f)
			}
		}
		result = append(result, packageFiles)
	}
	return result, err
}

func isDir(filename string) bool {
	fi, err := os.Stat(filename)
	return err == nil && fi.IsDir()
}

func exists(filename string) bool {
	_, err := os.Stat(filename)
	return err == nil
}

func resolveDir(dirname string) ([]string, error) {
	pkg, err := build.ImportDir(dirname, 0)
	return resolveImportedPackage(pkg, err)
}

func resolvePackage(pkgname string) ([]string, error) {
	pkg, err := build.Import(pkgname, ".", 0)
	return resolveImportedPackage(pkg, err)
}

func resolveImportedPackage(pkg *build.Package, err error) ([]string, error) {
	if err != nil {
		if _, nogo := err.(*build.NoGoError); nogo {
			// Don't complain if the failure is due to no Go source files.
			return nil, nil
		}
		return nil, err
	}

	var files []string
	files = append(files, pkg.GoFiles...)
	files = append(files, pkg.CgoFiles...)
	files = append(files, pkg.TestGoFiles...)
	if pkg.Dir != "." {
		for i, f := range files {
			files[i] = filepath.Join(pkg.Dir, f)
		}
	}
	return files, nil
}

func resolvePatterns(patterns []string) ([][]string, error) {
	var files [][]string
	for _, pattern := range patterns {
		f, err := resolvePattern(pattern)
		if err != nil {
			return nil, err
		}
		files = append(files, f...)
	}
	return files, nil
}

func resolvePattern(pattern string) ([][]string, error) {
	// dirsRun, filesRun, and pkgsRun indicate whether golint is applied to
	// directory, file or package targets. The distinction affects which
	// checks are run. It is no valid to mix target types.
	var dirsRun, filesRun, pkgsRun int
	var matches []string

	if strings.HasSuffix(pattern, "/...") && isDir(pattern[:len(pattern)-len("/...")]) {
		dirsRun = 1
		for _, dirname := range matchPackagesInFS(pattern) {
			matches = append(matches, dirname)
		}
	} else if isDir(pattern) {
		dirsRun = 1
		matches = append(matches, pattern)
	} else if exists(pattern) {
		filesRun = 1
		matches = append(matches, pattern)
	} else {
		pkgsRun = 1
		matches = append(matches, pattern)
	}

	result := [][]string{}
	switch {
	case dirsRun == 1:
		for _, dir := range matches {
			res, err := resolveDir(dir)
			if err != nil {
				return nil, err
			}
			result = append(result, res)
		}
	case filesRun == 1:
		return [][]string{matches}, nil
	case pkgsRun == 1:
		for _, pkg := range importPaths(matches) {
			res, err := resolvePackage(pkg)
			if err != nil {
				return nil, err
			}
			result = append(result, res)
		}
	}
	return result, nil
}

func newPathFilter(skip []string) func(string) bool {
	filter := map[string]bool{}
	for _, name := range skip {
		filter[name] = true
	}

	return func(path string) bool {
		base := filepath.Base(path)
		if filter[base] || filter[path] {
			return true
		}
		return base != "." && base != ".." && strings.ContainsAny(base[0:1], "_.")
	}
}

// importPathsNoDotExpansion returns the import paths to use for the given
// command line, but it does no ... expansion.
func importPathsNoDotExpansion(args []string) []string {
	if len(args) == 0 {
		return []string{"."}
	}
	var out []string
	for _, a := range args {
		// Arguments are supposed to be import paths, but
		// as a courtesy to Windows developers, rewrite \ to /
		// in command-line arguments.  Handles .\... and so on.
		if filepath.Separator == '\\' {
			a = strings.Replace(a, `\`, `/`, -1)
		}

		// Put argument in canonical form, but preserve leading ./.
		if strings.HasPrefix(a, "./") {
			a = "./" + path.Clean(a)
			if a == "./." {
				a = "."
			}
		} else {
			a = path.Clean(a)
		}
		if a == "all" || a == "std" {
			out = append(out, matchPackages(a)...)
			continue
		}
		out = append(out, a)
	}
	return out
}

// importPaths returns the import paths to use for the given command line.
func importPaths(args []string) []string {
	args = importPathsNoDotExpansion(args)
	var out []string
	for _, a := range args {
		if strings.Contains(a, "...") {
			if build.IsLocalImport(a) {
				out = append(out, matchPackagesInFS(a)...)
			} else {
				out = append(out, matchPackages(a)...)
			}
			continue
		}
		out = append(out, a)
	}
	return out
}

// matchPattern(pattern)(name) reports whether
// name matches pattern.  Pattern is a limited glob
// pattern in which '...' means 'any string' and there
// is no other special syntax.
func matchPattern(pattern string) func(name string) bool {
	re := regexp.QuoteMeta(pattern)
	re = strings.Replace(re, `\.\.\.`, `.*`, -1)
	// Special case: foo/... matches foo too.
	if strings.HasSuffix(re, `/.*`) {
		re = re[:len(re)-len(`/.*`)] + `(/.*)?`
	}
	reg := regexp.MustCompile(`^` + re + `$`)
	return func(name string) bool {
		return reg.MatchString(name)
	}
}

// hasPathPrefix reports whether the path s begins with the
// elements in prefix.
func hasPathPrefix(s, prefix string) bool {
	switch {
	default:
		return false
	case len(s) == len(prefix):
		return s == prefix
	case len(s) > len(prefix):
		if prefix != "" && prefix[len(prefix)-1] == '/' {
			return strings.HasPrefix(s, prefix)
		}
		return s[len(prefix)] == '/' && s[:len(prefix)] == prefix
	}
}

// treeCanMatchPattern(pattern)(name) reports whether
// name or children of name can possibly match pattern.
// Pattern is the same limited glob accepted by matchPattern.
func treeCanMatchPattern(pattern string) func(name string) bool {
	wildCard := false
	if i := strings.Index(pattern, "..."); i >= 0 {
		wildCard = true
		pattern = pattern[:i]
	}
	return func(name string) bool {
		return len(name) <= len(pattern) && hasPathPrefix(pattern, name) ||
			wildCard && strings.HasPrefix(name, pattern)
	}
}

func matchPackages(pattern string) []string {
	match := func(string) bool { return true }
	treeCanMatch := func(string) bool { return true }
	if pattern != "all" && pattern != "std" {
		match = matchPattern(pattern)
		treeCanMatch = treeCanMatchPattern(pattern)
	}

	have := map[string]bool{
		"builtin": true, // ignore pseudo-package that exists only for documentation
	}
	if !buildContext.CgoEnabled {
		have["runtime/cgo"] = true // ignore during walk
	}
	var pkgs []string

	// Commands
	cmd := filepath.Join(goroot, "src/cmd") + string(filepath.Separator)
	filepath.Walk(cmd, func(path string, fi os.FileInfo, err error) error {
		if err != nil || !fi.IsDir() || path == cmd {
			return nil
		}
		name := path[len(cmd):]
		if !treeCanMatch(name) {
			return filepath.SkipDir
		}
		// Commands are all in cmd/, not in subdirectories.
		if strings.Contains(name, string(filepath.Separator)) {
			return filepath.SkipDir
		}

		// We use, e.g., cmd/gofmt as the pseudo import path for gofmt.
		name = "cmd/" + name
		if have[name] {
			return nil
		}
		have[name] = true
		if !match(name) {
			return nil
		}
		_, err = buildContext.ImportDir(path, 0)
		if err != nil {
			if _, noGo := err.(*build.NoGoError); !noGo {
				log.Print(err)
			}
			return nil
		}
		pkgs = append(pkgs, name)
		return nil
	})

	for _, src := range buildContext.SrcDirs() {
		if (pattern == "std" || pattern == "cmd") && src != gorootSrc {
			continue
		}
		src = filepath.Clean(src) + string(filepath.Separator)
		root := src
		if pattern == "cmd" {
			root += "cmd" + string(filepath.Separator)
		}
		filepath.Walk(root, func(path string, fi os.FileInfo, err error) error {
			if err != nil || !fi.IsDir() || path == src {
				return nil
			}

			// Avoid .foo, _foo, and testdata directory trees.
			_, elem := filepath.Split(path)
			if strings.HasPrefix(elem, ".") || strings.HasPrefix(elem, "_") || elem == "testdata" {
				return filepath.SkipDir
			}

			name := filepath.ToSlash(path[len(src):])
			if pattern == "std" && (strings.Contains(name, ".") || name == "cmd") {
				// The name "std" is only the standard library.
				// If the name is cmd, it's the root of the command tree.
				return filepath.SkipDir
			}
			if !treeCanMatch(name) {
				return filepath.SkipDir
			}
			if have[name] {
				return nil
			}
			have[name] = true
			if !match(name) {
				return nil
			}
			_, err = buildContext.ImportDir(path, 0)
			if err != nil {
				if _, noGo := err.(*build.NoGoError); noGo {
					return nil
				}
			}
			pkgs = append(pkgs, name)
			return nil
		})
	}
	return pkgs
}

func matchPackagesInFS(pattern string) []string {
	// Find directory to begin the scan.
	// Could be smarter but this one optimization
	// is enough for now, since ... is usually at the
	// end of a path.
	i := strings.Index(pattern, "...")
	dir, _ := path.Split(pattern[:i])

	// pattern begins with ./ or ../.
	// path.Clean will discard the ./ but not the ../.
	// We need to preserve the ./ for pattern matching
	// and in the returned import paths.
	prefix := ""
	if strings.HasPrefix(pattern, "./") {
		prefix = "./"
	}
	match := matchPattern(pattern)

	var pkgs []string
	filepath.Walk(dir, func(path string, fi os.FileInfo, err error) error {
		if err != nil || !fi.IsDir() {
			return nil
		}
		if path == dir {
			// filepath.Walk starts at dir and recurses. For the recursive case,
			// the path is the result of filepath.Join, which calls filepath.Clean.
			// The initial case is not Cleaned, though, so we do this explicitly.
			//
			// This converts a path like "./io/" to "io". Without this step, running
			// "cd $GOROOT/src/pkg; go list ./io/..." would incorrectly skip the io
			// package, because prepending the prefix "./" to the unclean path would
			// result in "././io", and match("././io") returns false.
			path = filepath.Clean(path)
		}

		// Avoid .foo, _foo, and testdata directory trees, but do not avoid "." or "..".
		_, elem := filepath.Split(path)
		dot := strings.HasPrefix(elem, ".") && elem != "." && elem != ".."
		if dot || strings.HasPrefix(elem, "_") || elem == "testdata" {
			return filepath.SkipDir
		}

		name := prefix + filepath.ToSlash(path)
		if !match(name) {
			return nil
		}
		if _, err = build.ImportDir(path, 0); err != nil {
			if _, noGo := err.(*build.NoGoError); !noGo {
				log.Print(err)
			}
			return nil
		}
		pkgs = append(pkgs, name)
		return nil
	})
	return pkgs
}

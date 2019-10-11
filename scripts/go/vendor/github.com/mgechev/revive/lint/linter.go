package lint

import (
	"bufio"
	"bytes"
	"fmt"
	"go/token"
	"os"
	"sync"
)

// ReadFile defines an abstraction for reading files.
type ReadFile func(path string) (result []byte, err error)

type disabledIntervalsMap = map[string][]DisabledInterval

// Linter is used for linting set of files.
type Linter struct {
	reader ReadFile
}

// New creates a new Linter
func New(reader ReadFile) Linter {
	return Linter{reader: reader}
}

var (
	genHdr = []byte("// Code generated ")
	genFtr = []byte(" DO NOT EDIT.")
)

// Lint lints a set of files with the specified rule.
func (l *Linter) Lint(packages [][]string, ruleSet []Rule, config Config) (<-chan Failure, error) {
	failures := make(chan Failure)

	var wg sync.WaitGroup
	for _, pkg := range packages {
		wg.Add(1)
		go func(pkg []string) {
			if err := l.lintPackage(pkg, ruleSet, config, failures); err != nil {
				fmt.Fprintln(os.Stderr, err)
				os.Exit(1)
			}
			defer wg.Done()
		}(pkg)
	}

	go func() {
		wg.Wait()
		close(failures)
	}()

	return failures, nil
}

func (l *Linter) lintPackage(filenames []string, ruleSet []Rule, config Config, failures chan Failure) error {
	pkg := &Package{
		fset:  token.NewFileSet(),
		files: map[string]*File{},
		mu:    sync.Mutex{},
	}
	for _, filename := range filenames {
		content, err := l.reader(filename)
		if err != nil {
			return err
		}
		if isGenerated(content) && !config.IgnoreGeneratedHeader {
			continue
		}

		file, err := NewFile(filename, content, pkg)
		if err != nil {
			return err
		}
		pkg.files[filename] = file
	}

	if len(pkg.files) == 0 {
		return nil
	}

	pkg.lint(ruleSet, config, failures)

	return nil
}

// isGenerated reports whether the source file is generated code
// according the rules from https://golang.org/s/generatedcode.
// This is inherited from the original go lint.
func isGenerated(src []byte) bool {
	sc := bufio.NewScanner(bytes.NewReader(src))
	for sc.Scan() {
		b := sc.Bytes()
		if bytes.HasPrefix(b, genHdr) && bytes.HasSuffix(b, genFtr) && len(b) >= len(genHdr)+len(genFtr) {
			return true
		}
	}
	return false
}

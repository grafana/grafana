package golangci

import (
	"regexp"

	"github.com/golangci/errcheck/internal/errcheck"
	"golang.org/x/tools/go/loader"
)

var dotStar = regexp.MustCompile(".*")

type Issue errcheck.UncheckedError

func Run(program *loader.Program, checkBlank, checkAsserts bool) ([]Issue, error) {
	return RunWithConfig(program, &Config{
		Blank:   checkBlank,
		Asserts: checkAsserts,
	})
}

// Config is a copy of the `errcheck.Checker` with exported `Exclude` field.
type Config struct {
	// ignore is a map of package names to regular expressions. Identifiers from a package are
	// checked against its regular expressions and if any of the expressions match the call
	// is not checked.
	Ignore map[string]*regexp.Regexp

	// If blank is true then assignments to the blank identifier are also considered to be
	// ignored errors.
	Blank bool

	// If asserts is true then ignored type assertion results are also checked
	Asserts bool

	// build tags
	Tags []string

	Verbose bool

	// If true, checking of _test.go files is disabled
	WithoutTests bool

	// Excluded functions.
	Exclude map[string]bool
}

// RunWithConfig runs the `errchecker` linter with all its options.
func RunWithConfig(program *loader.Program, c *Config) ([]Issue, error) {
	checker := errcheck.NewChecker()
	checker.Tags = c.Tags
	checker.Blank = c.Blank
	checker.Asserts = c.Asserts
	checker.Verbose = c.Verbose
	checker.WithoutTests = c.WithoutTests

	checker.SetExclude(c.Exclude)

	checker.Ignore = map[string]*regexp.Regexp{}
	for pkg, re := range c.Ignore {
		checker.Ignore[pkg] = re
	}

	if err := checker.CheckProgram(program); err != nil {
		if e, ok := err.(*errcheck.UncheckedErrors); ok {
			return makeIssues(e), nil
		}
		if err == errcheck.ErrNoGoFiles {
			return nil, nil
		}

		return nil, err
	}

	// no issues
	return nil, nil
}

func makeIssues(e *errcheck.UncheckedErrors) []Issue {
	var ret []Issue
	for _, uncheckedError := range e.Errors {
		ret = append(ret, Issue(uncheckedError))
	}

	return ret
}
